import { Exam, ExamSubmission } from "../models/AIExaminer.model.js";
import { uploadMedia, deleteMediaFromCloudinary } from "../utils/cloudinary.js";
import { evaluateNeetOMR } from "../utils/neetOmrEvaluator.js";
import axios from "axios";
import { execFile } from "node:child_process";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

export const uploadExam = async (req, res) => {
  try {
    const instructorId = req.id;
    const { name } = req.body;
    const existingExam = await Exam.findOne();

    let newExamData = {};
    let oldPublicIds = [];

    if (name) {
      newExamData.name = name;
    }

    if (req.files && req.files.questions) {
      const questionFile = req.files.questions[0];
      const questionResponse = await uploadMedia(questionFile.path);
      if (!questionResponse) {
        return res
          .status(400)
          .json({ message: "Error on uploading question file" });
      }
      newExamData.questionPaper = {
        url: questionResponse.secure_url,
        publicId: questionResponse.public_id,
      };
      if (existingExam && existingExam.questionPaper) {
        oldPublicIds.push(existingExam.questionPaper.publicId);
      }
    }

    if (req.files && req.files.answerKey) {
      const answerKeyFile = req.files.answerKey[0];
      const answerKeyResponse = await uploadMedia(answerKeyFile.path);
      if (!answerKeyResponse) {
        return res
          .status(400)
          .json({ message: "Error on uploading answerkey file" });
      }
      newExamData.answerKey = {
        url: answerKeyResponse.secure_url,
        publicId: answerKeyResponse.public_id,
      };
      if (existingExam && existingExam.answerKey) {
        oldPublicIds.push(existingExam.answerKey.publicId);
      }
    }

    if (req.files && req.files.omr) {
      const omrFile = req.files.omr[0];
      const omrResponse = await uploadMedia(omrFile.path);
      if (!omrResponse) {
        return res.status(400).json({ message: "Error on uploading omr file" });
      }
      newExamData.omrSheet = {
        url: omrResponse.secure_url,
        publicId: omrResponse.public_id,
      };
      if (existingExam && existingExam.omrSheet) {
        oldPublicIds.push(existingExam.omrSheet.publicId);
      }
    }

    if (existingExam) {
      existingExam.set(newExamData);
      const updatedExam = await existingExam.save();

      if (oldPublicIds.length > 0) {
        await Promise.all(
          oldPublicIds
            .filter((id) => id)
            .map((id) => deleteMediaFromCloudinary(id)),
        );
      }

      return res.status(200).json({
        success: true,
        message: "Exam updated successfully",
        exam: updatedExam,
      });
    } else {
      if (
        !newExamData.name ||
        !newExamData.questionPaper ||
        !newExamData.answerKey ||
        !newExamData.omrSheet
      ) {
        return res.status(400).json({ message: "upload all files" });
      }
      newExamData.instructor = instructorId;
      const newExam = await Exam.create(newExamData);
      return res.status(200).json({
        success: true,
        message: "exam uploaded successfully",
        newExam,
      });
    }
  } catch (err) {
    return res.status(400).json({ message: "Server error on exam upload" });
  }
};

export const getExam = async (req, res) => {
  try {
    const exam = await Exam.findOne().select("-answerKey");
    if (!exam) {
      return res.status(404).json({ message: "no exam has been uploaded yet" });
    }

    const examDetail = {
      _id: exam._id,
      name: exam.name,
      questionPaperUrl: exam.questionPaper.url,
      omrSheetUrl: exam.omrSheet.url,
    };

    return res.status(200).json({
      success: true,
      message: "Exam details",
      examDetail,
    });
  } catch (err) {
    return res.status(400).json({
      message: "error on hiting getExam controller",
      error: err,
    });
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_PATH = "C:\\Users\\Yachna Gupta\\AppData\\Local\\Programs\\Python\\Python313\\python.exe";
const UPLOADS_DIR = path.join(__dirname, "../uploads");

export const getStudentAnswers = async (imageUrl) => {
  // Ensure uploads dir exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const cleanUrl = imageUrl.split('?')[0];
  const urlParts = cleanUrl.split('/');
  const lastSegment = urlParts[urlParts.length - 1];
  const extension = lastSegment.includes('.') ? lastSegment.split('.').pop().toLowerCase() : 'jpg';
  const safeExt = ['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(extension) ? extension : 'jpg';
  const tempFileName = `omr_${crypto.randomUUID()}.${safeExt}`;
  const tempPath = path.join(UPLOADS_DIR, tempFileName);

  try {
    // Download image from Cloudinary
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

    console.log(`[OMR] Downloaded ${imageUrl} — ${response.data.length} bytes`);
    if (!response.data || response.data.length === 0) {
      throw new Error("Downloaded image data is empty");
    }

    fs.writeFileSync(tempPath, response.data);
    console.log(`[OMR] Saved temp file: ${tempPath}`);

    const scriptPath = path.join(__dirname, "../omr/omr_pipeline.py");
    console.log(`[OMR] Running Python: ${PYTHON_PATH} ${scriptPath}`);

    return await new Promise((resolve, reject) => {
      execFile(
        PYTHON_PATH,
        [scriptPath, "--mode", "student", "--image", tempPath],
        { maxBuffer: 1024 * 1024 * 10 },
        (err, stdout, stderr) => {
          if (stderr && stderr.length > 0) {
            console.warn("[OMR Python stderr]:", stderr);
          }
          if (err) {
            console.error("[OMR] Python process error:", err.message);
            return reject(new Error(`Python script failed: ${stderr || err.message}`));
          }

          try {
            const cleanOutput = stdout.toString().trim();
            if (!cleanOutput) {
              throw new Error("Python script returned empty output");
            }
            const answers = JSON.parse(cleanOutput);

            if (!Array.isArray(answers)) {
              throw new Error("ML output is not an array");
            }

            console.log(`[OMR] Detected ${answers.length} answers from ML model`);
            resolve(answers);
          } catch (parseErr) {
            console.error("[OMR] JSON parse error. Raw stdout:", stdout.toString().substring(0, 200));
            reject(parseErr);
          }
        },
      );
    });
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
      console.log(`[OMR] Cleaned up temp file: ${tempPath}`);
    }
  }
};


const fetchAnswerKey = async (url) => {
  try {
    const res = await axios.get(url);
    const data = res.data;
    if (!Array.isArray(data)) {
      console.warn("Answer key is not an array, returning empty array");
      return [];
    }
    return data;
  } catch (err) {
    console.error("Failed to fetch answer key:", err.message);
    return [];
  }
};


export const submitOmr = async (req, res) => {
  try {
    const studentId = req.id;

    const exam = await Exam.findOne();
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload filled OMR" });
    }

    // 1. Upload student's filled OMR to Cloudinary
    const omrResponse = await uploadMedia(req.file);
    if (!omrResponse || !omrResponse.secure_url || !omrResponse.public_id) {
      return res.status(400).json({ success: false, message: "Failed to upload OMR to cloud storage" });
    }

    const newSubmission = await ExamSubmission.create({
      exam: exam._id,
      student: studentId,
      filledOmr: { url: omrResponse.secure_url, publicId: omrResponse.public_id },
    });

    // 2. Run ML on the instructor's answer key image to get correct answers
    let answerKey = [];
    try {
      const rawAnswerKey = await getStudentAnswers(exam.answerKey.url);
      // Map selectedOption -> correctOption, and only keep questions with a valid answer
      answerKey = rawAnswerKey
        .map((a) => {
          const correctOption = a.correctOption || a.selectedOption;
          if (!correctOption || correctOption === "MULTI") return null;
          let subject = "physics";
          if (a.questionNumber >= 51 && a.questionNumber <= 100) subject = "chemistry";
          if (a.questionNumber >= 101) subject = "biology";
          return { questionNumber: a.questionNumber, correctOption, subject };
        })
        .filter(Boolean);
      console.log(`[OMR] Answer key scanned: ${answerKey.length} valid answers found`);
    } catch (err) {
      console.error("[OMR] Answer key ML scan failed:", err.message);
    }

    // If answer key scan produced nothing (blank/template image), generate a placeholder
    // so the student still gets a submission record and detected marks
    if (!Array.isArray(answerKey) || answerKey.length === 0) {
      console.warn("[OMR] Answer key scan returned empty. Generating placeholder answer key.");
      answerKey = Array.from({ length: 200 }, (_, i) => ({
        questionNumber: i + 1,
        correctOption: null,
        subject: i < 50 ? "physics" : i < 100 ? "chemistry" : "biology",
      }));
    }

    // 3. Run ML on the student's filled OMR to get their answers
    let detectedAnswers = [];
    try {
      detectedAnswers = await getStudentAnswers(newSubmission.filledOmr.url);
      console.log(`[OMR] Student OMR scanned: ${detectedAnswers.length} answers detected`);
    } catch (mlError) {
      console.error("[OMR] Student OMR scan failed:", mlError.message);
      return res.status(500).json({ success: false, message: "OMR detection failed: " + mlError.message });
    }

    // 4. Build complete 200-question response — always include ALL questions
    //    regardless of whether they appear in the answer key
    const studentAnswersComplete = Array.from({ length: 200 }, (_, i) => {
      const qNum = i + 1;
      const detected = detectedAnswers.find((a) => a.questionNumber === qNum);
      return detected || { questionNumber: qNum, selectedOption: null };
    });

    // 5. Evaluate and save
    newSubmission.detectedMarks = studentAnswersComplete;
    const evaluation = evaluateNeetOMR({ answerKey, studentAnswers: studentAnswersComplete });
    newSubmission.evaluation = evaluation;
    await newSubmission.save();

    return res.status(200).json({
      success: true,
      message: "Your Filled OMR Submitted Successfully",
      submissionId: newSubmission._id,
      detectedMarks: studentAnswersComplete,
      evaluation,
    });
  } catch (error) {
    console.error("[OMR] submitOmr full error:", error);
    return res.status(500).json({
      success: false,
      message: "Error while submitting OMR",
      error: error.message,
    });
  }
};


export const evaluateOmr = async (req, res) => {
  console.log("evaluateOmr controller hit");
  try {
    const { submissionId } = req.params;
    const { answerKey } = req.body;

    if (!submissionId) {
      return res.status(400).json({ message: "submissionId is required" });
    }

    if (!Array.isArray(answerKey)) {
      return res.status(400).json({ message: "answerKey must be an array" });
    }

    const submission = await ExamSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "submission not found" });
    }

    // Calling Local ML Logic
    let studentAnswers = [];
    try {
      studentAnswers = await getStudentAnswers(submission.filledOmr.url);
    } catch (mlError) {
      return res.status(500).json({
        success: false,
        message: "OMR detection failed",
        error: mlError.message,
      });
    }

    if (!Array.isArray(studentAnswers)) {
      return res.status(500).json({ message: "ML detection failed" });
    }

    const evaluation = evaluateNeetOMR({
      answerKey,
      studentAnswers,
    });

    submission.detectedMarks = studentAnswers;
    submission.evaluation = evaluation;
    await submission.save();

    return res.status(200).json({
      success: true,
      message: "OMR evaluated successfully",
      detectedMarks: studentAnswers,
      evaluation,
    });
  } catch (error) {
    return res.status(500).json({
      message: "error on evaluating OMR",
      error,
    });
  }
};

export const getExamResult = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({ message: "submissionId is required" });
    }

    const submission = await ExamSubmission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "submission not found" });
    }

    if (!submission.evaluation) {
      return res
        .status(400)
        .json({ message: "evaluation not available for this submission yet" });
    }

    return res.status(200).json({
      success: true,
      message: "Exam evaluation fetched successfully",
      detectedMarks: submission.detectedMarks || [],
      evaluation: submission.evaluation,
    });
  } catch (err) {
    return res.status(500).json({
      message: "error on fetching exam evaluation",
      error: err,
    });
  }
};

export const getDetectedAnswers = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({ message: "submissionId is required" });
    }

    const submission =
      await ExamSubmission.findById(submissionId).select("detectedMarks");

    if (!submission) {
      return res.status(404).json({ message: "submission not found" });
    }

    return res.status(200).json({
      success: true,
      detectedAnswers: submission.detectedMarks || [],
    });
  } catch (error) {
    return res.status(500).json({
      message: "error on fetching detected answers",
      error: error.toString(),
    });
  }
};
