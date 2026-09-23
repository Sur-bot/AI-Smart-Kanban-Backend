require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const imageQueue = require("./config/imageQueue");
const { authenticate } = require("./middleware/auth");

const profileRoutes = require("./routes/profileRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const storageRoutes = require('./routes/storageRoutes');
const userRoutes = require('./routes/userRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin) || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info", "Accept", "Origin", "X-Requested-With"]
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use("/api/profile", profileRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);

app.post("/api/jobs/process-image", authenticate, async (req, res) => {
  try {
    const { fileId, storageKey, userId } = req.body;

    if (!fileId || !storageKey) {
      return res.status(400).json({ error: "Missing fileId or storageKey" });
    }

    await imageQueue.add("optimize-image", { fileId, storageKey, userId }, {
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`[API] Job queued: ${fileId} (User: ${req.user.id})`);
    return res.status(200).json({ message: "Job queued successfully", fileId });

  } catch (error) {
    console.error("[API Error]:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/jobs/image/:id", authenticate, async (req, res) => {
  try {
    const fileId = req.params.id;
    const requestingUserId = req.user.id;
    const supabase = require("./config/supabase");
    const BUCKET_NAME = "ai-kanban-storage";

    // 1. Get file info from DB
    const { data: fileData, error: fetchError } = await supabase
      .from("storage_files")
      .select("storage_key, thumbnail_key, user_id, size_bytes")
      .eq("id", fileId)
      .single();

    if (fetchError || !fileData) {
      return res.status(404).json({ error: "File not found" });
    }

    if (fileData.user_id && fileData.user_id !== requestingUserId) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete this file" });
    }

    // 2. Soft delete in DB
    const { error: dbError } = await supabase
      .from("storage_files")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", fileId);

    if (dbError) throw dbError;

    // 3. Remove physical files from Storage bucket
    const keysToDelete = [fileData.storage_key];
    if (fileData.thumbnail_key) keysToDelete.push(fileData.thumbnail_key);

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(keysToDelete);

    if (storageError) {
      console.warn("[API] Storage removal warning:", storageError.message);
    }

    // 4. Recalculate user quota after deletion
    if (fileData.user_id) {
      await storageService.recalculateUserQuota(fileData.user_id);
    }

    console.log(`[API] Deleted: ${fileId} by user: ${requestingUserId}`);
    return res.status(200).json({ message: "File deleted successfully" });

  } catch (error) {
    console.error("[API Delete Error]:", error.message);
    return res.status(500).json({ error: "Internal server error while deleting file" });
  }
});


app.delete("/api/jobs/images/bulk", authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    const requestingUserId = req.user.id;
    const supabase = require("./config/supabase");
    const BUCKET_NAME = "ai-kanban-storage";
    const storageService = require("./services/storageService");

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required and must not be empty" });
    }

    if (ids.length > 2000) {
      return res.status(400).json({ error: "Maximum 2000 files can be deleted at once" });
    }

    const { data: filesData, error: fetchError } = await supabase
      .from("storage_files")
      .select("id, storage_key, thumbnail_key, user_id, size_bytes")
      .in("id", ids);

    if (fetchError) {
      return res.status(500).json({ error: "Error fetching files from database" });
    }

    if (!filesData || filesData.length === 0) {
      return res.status(404).json({ error: "No files found" });
    }

    const unauthorizedFiles = filesData.filter(f => f.user_id && f.user_id !== requestingUserId);
    if (unauthorizedFiles.length > 0) {
      return res.status(403).json({ error: "Forbidden", message: "You do not have permission to delete some of these files" });
    }

    const validIds = filesData.map(f => f.id);
    const keysToDelete = filesData.map(f => f.storage_key);
    filesData.forEach(f => {
      if (f.thumbnail_key) keysToDelete.push(f.thumbnail_key);
    });

    const { error: dbError } = await supabase
      .from("storage_files")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .in("id", validIds);

    if (dbError) throw dbError;

    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(keysToDelete);

    if (storageError) {
      console.warn("[API] Bulk Storage removal warning:", storageError.message);
    }

    await storageService.recalculateUserQuota(requestingUserId);

    console.log(`[API] Bulk Deleted: ${validIds.length} files by user: ${requestingUserId}`);
    return res.status(200).json({ message: "Files deleted successfully", deletedCount: validIds.length });

  } catch (error) {
    console.error("[API Bulk Delete Error]:", error.message);
    return res.status(500).json({ error: "Internal server error while deleting files" });
  }
});
app.use((err, req, res, _next) => {
  console.error("[Global Error Handler]:", err.message);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS policy violation" });
  }
  return res.status(500).json({ error: "Internal server error", details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[Server] Backend API running on port ${PORT}`);
  require("./worker");
});





