const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const userController = require('../controllers/userController');

// All user routes require authentication
router.use(authenticate);

// -- User Search ---------------------------------------------------------------
router.get('/search', userController.searchUsers);

module.exports = router;
