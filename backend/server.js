// ================== MODERN EXAM BACKEND ==================

const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// ---------- DATA PATHS ----------
const DATA_DIR = path.join(__dirname, "./data");
const STUDENTS = path.join(DATA_DIR, "students.json");
const TESTS = path.join(DATA_DIR, "tests.json");
const ATTEMPTS = path.join(DATA_DIR, "attempts.json");

// ---------- INIT ----------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(STUDENTS)) fs.writeFileSync(STUDENTS, "[]");
if (!fs.existsSync(TESTS)) fs.writeFileSync(TESTS, "[]");
if (!fs.existsSync(ATTEMPTS)) fs.writeFileSync(ATTEMPTS, "[]");

// ---------- HELPERS ----------
const read = f => JSON.parse(fs.readFileSync(f, "utf8"));
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));

const validPhone = p => /^[6-9]\d{9}$/.test(p);
const numeric = v => /^\d+$/.test(v);

// ========================================================
// STUDENT
// ========================================================

// Login / Register student (only once)
app.post("/api/student/login", (req, res) => {
  
  console.log("LOGIN BODY:", req.body);

  const { name, father, roll, className, phone } = req.body;

  if (!name || !father || !roll || !className || !phone)
    return res.status(400).json({ error: "Invalid data" });

  if (!numeric(roll) || !validPhone(phone))
    return res.status(400).json({ error: "Invalid roll or phone" });

  const students = read(STUDENTS);

  let student = students.find(
    s => s.roll === roll && s.className === className
  );

  if (!student) {
    student = {
      id: Date.now().toString(),
      name,
      father,
      roll,
      className,
      phone
    };
    students.push(student);
    write(STUDENTS, students);
  }

  res.json(student);
});

// Get available tests (by class, not attempted)
app.get("/api/student/tests/:studentId", (req, res) => {
  const students = read(STUDENTS);
  const tests = read(TESTS);
  const attempts = read(ATTEMPTS);

  const student = students.find(s => s.id === req.params.studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const attempted = attempts
    .filter(a => a.studentId === student.id)
    .map(a => a.testId);

  const available = tests.filter(
    t =>
      t.status === "published" &&
      t.className === student.className &&
      !attempted.includes(t.id)
  );

  res.json(available.map(t => ({
    id: t.id,
    title: t.title,
    subject: t.subject,
    duration: t.duration
  })));
});

// Get test paper (safe)
app.get("/api/student/test/:testId", (req, res) => {
  const test = read(TESTS).find(t => t.id === req.params.testId);
  if (!test) return res.status(404).json({ error: "Test not found" });

  res.json({
    id: test.id,
    title: test.title,
    subject: test.subject,
    duration: test.duration,
    questions: test.questions.map(q => ({
      text: q.text,
      options: q.options
    }))
  });
});

// Submit test (only once)
app.post("/api/student/submit", (req, res) => {
  const { studentId, testId, answers } = req.body;

  const attempts = read(ATTEMPTS);
  if (attempts.some(a => a.studentId === studentId && a.testId === testId))
    return res.status(403).json({ error: "Already attempted" });

  const test = read(TESTS).find(t => t.id === testId);
  if (!test) return res.status(404).json({ error: "Test not found" });

  let score = 0;
  test.questions.forEach((q, i) => {
    if (answers[i] === q.correct) score++;
  });

  attempts.push({
    studentId,
    testId,
    score,
    total: test.questions.length,
    time: new Date().toISOString()
  });

  write(ATTEMPTS, attempts);
  res.json({ score, total: test.questions.length });
});

// ========================================================
// ADMIN
// ========================================================

// Create test
app.post("/api/admin/test", (req, res) => {
  const { title, subject, className, duration, questions } = req.body;

  if (!title || !subject || !className || !duration || !questions.length)
    return res.status(400).json({ error: "Invalid test" });

  const tests = read(TESTS);
  tests.push({
    id: Date.now().toString(),
    title,
    subject,
    className,
    duration,
    questions,
    status: "published"
  });

  write(TESTS, tests);
  res.json({ status: "created" });
});

// View results
app.get("/api/admin/results", (req, res) => {
  const students = read(STUDENTS);
  const tests = read(TESTS);
  const attempts = read(ATTEMPTS);

  const detailed = attempts.map(a => {
    const student = students.find(s => s.id === a.studentId);
    const test = tests.find(t => t.id === a.testId);
    return {
      student,
      test: test?.title,
      score: a.score,
      total: a.total,
      time: a.time
    };
  });

  res.json(detailed);
});

// ========================================================
app.listen(3000, () => {
  console.log("Server running at https://exam-backend-1-0tmx.onrender.com");
});
