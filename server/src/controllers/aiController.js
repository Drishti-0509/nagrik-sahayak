const { analyzeComplaint } = require('../services/geminiService');

/**
 * @desc    Analyze complaint text for civic category, department, priority, summary & next action
 * @route   POST /api/v1/ai/analyze
 * @access  Protected (Authenticated users)
 */
const analyzeGrievance = async (req, res, next) => {
  try {
    const { title, description, location } = req.body;

    if (!description || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least a brief description of the civic problem for AI analysis.',
      });
    }

    const analysis = await analyzeComplaint({
      title: title || '',
      description: description.trim(),
      location: location || {},
    });

    res.status(200).json({
      success: true,
      analysis,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  analyzeGrievance,
};
