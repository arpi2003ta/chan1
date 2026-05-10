export const evaluateNeetOMR = ({ answerKey, studentAnswers }) => {
  const answerKeyMap = new Map();
  for (const item of answerKey) {
    const questionNumber = Number(item.questionNumber);
    if (!Number.isFinite(questionNumber)) {
      continue;
    }
    const correctOption =
      item.correctOption != null
        ? String(item.correctOption).toUpperCase()
        : null;
    if (!correctOption) {
      continue;
    }
    answerKeyMap.set(questionNumber, correctOption);
  }

  const studentMap = new Map();
  for (const item of studentAnswers) {
    const questionNumber = Number(item.questionNumber);
    if (!Number.isFinite(questionNumber)) {
      continue;
    }
    const selectedOption =
      item.selectedOption != null
        ? String(item.selectedOption).toUpperCase()
        : null;
    studentMap.set(questionNumber, { ...item, questionNumber, selectedOption });
  }

  let physicsMarks = 0;
  let chemistryMarks = 0;
  let biologyMarks = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  const wrongQuestions = [];

  // Each subject has 50 questions: 35 Mandatory + 15 Optional (only 10 count)
  const blocks = [
    { start: 1, end: 50, subject: "physics" },
    { start: 51, end: 100, subject: "chemistry" },
    { start: 101, end: 200, subject: "biology" } // 101-150 + 151-200
  ];

  const processBlock = (start, end, subject) => {
    let blockMarks = 0;
    // Section A (1-35 of total 50)
    for (let q = start; q < start + 35; q++) {
      const correctOption = answerKeyMap.get(q);
      const studentEntry = studentMap.get(q);
      if (!correctOption) continue;

      if (!studentEntry || !studentEntry.selectedOption) {
        unattemptedCount += 1;
        continue;
      }

      if (studentEntry.selectedOption === correctOption) {
        correctCount += 1;
        blockMarks += 4;
      } else {
        incorrectCount += 1;
        blockMarks -= 1;
        wrongQuestions.push({ questionNumber: q, subject, selectedOption: studentEntry.selectedOption, correctOption });
      }
    }

    // Section B (36-50 of total 50) - Only first 10 attempted count
    const sectionBStart = start + 35;
    const attemptedB = [];
    for (let q = sectionBStart; q <= end; q++) {
      const studentEntry = studentMap.get(q);
      if (studentEntry && studentEntry.selectedOption) {
        attemptedB.push(q);
      }
    }

    const countedB = attemptedB.slice(0, 10);
    const uncountedB = attemptedB.slice(10);

    for (let q = sectionBStart; q <= end; q++) {
      const correctOption = answerKeyMap.get(q);
      const studentEntry = studentMap.get(q);
      if (!correctOption) continue;

      if (!studentEntry || !studentEntry.selectedOption) {
        unattemptedCount += 1;
        continue;
      }

      if (countedB.includes(q)) {
        if (studentEntry.selectedOption === correctOption) {
          correctCount += 1;
          blockMarks += 4;
        } else {
          incorrectCount += 1;
          blockMarks -= 1;
          wrongQuestions.push({ questionNumber: q, subject, selectedOption: studentEntry.selectedOption, correctOption });
        }
      } else {
        // Not counted
      }
    }
    return blockMarks;
  };

  physicsMarks = processBlock(1, 50, "physics");
  chemistryMarks = processBlock(51, 100, "chemistry");
  // Biology is two blocks of 50 in NEET (Botany + Zoology)
  biologyMarks = processBlock(101, 150, "biology") + processBlock(151, 200, "biology");

  totalMarks = physicsMarks + chemistryMarks + biologyMarks;

  return {
    physicsMarks,
    chemistryMarks,
    biologyMarks,
    totalMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    wrongQuestions,
  };
};

function getSubject(questionNumber) {
  if (questionNumber >= 1 && questionNumber <= 50) {
    return "physics";
  }
  if (questionNumber >= 51 && questionNumber <= 100) {
    return "chemistry";
  }
  return "biology";
}
