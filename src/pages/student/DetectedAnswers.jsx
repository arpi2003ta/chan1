import apiClient from "@/api/axios";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const OPTIONS = ["A", "B", "C", "D"];

const SUBJECTS = [
  { label: "Physics", start: 1, end: 50, color: "blue" },
  { label: "Chemistry", start: 51, end: 100, color: "green" },
  { label: "Biology (Botany)", start: 101, end: 150, color: "teal" },
  { label: "Biology (Zoology)", start: 151, end: 200, color: "orange" },
];

const SUBJECT_STYLES = {
  blue: {
    header: "bg-blue-600 text-white",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    selected: "bg-blue-500 text-white border-blue-500",
    hover: "hover:border-blue-400",
  },
  green: {
    header: "bg-green-600 text-white",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    selected: "bg-green-500 text-white border-green-500",
    hover: "hover:border-green-400",
  },
  teal: {
    header: "bg-teal-600 text-white",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
    selected: "bg-teal-500 text-white border-teal-500",
    hover: "hover:border-teal-400",
  },
  orange: {
    header: "bg-orange-500 text-white",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    selected: "bg-orange-500 text-white border-orange-500",
    hover: "hover:border-orange-400",
  },
};

const QuestionCard = ({ ans, subject }) => {
  const styles = SUBJECT_STYLES[subject.color];
  const selected = ans?.selectedOption;
  const isMulti = selected === "MULTI";
  const isUnattempted = !selected || selected === null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${styles.badge}`}>
          Q {ans.questionNumber}
        </span>
        {isMulti && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
            ⚠ Multiple Marked
          </span>
        )}
        {isUnattempted && !isMulti && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            Unattempted
          </span>
        )}
        {selected && !isMulti && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            ✓ Marked: {selected}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt;
          return (
            <div
              key={opt}
              className={`
                flex items-center justify-center rounded-lg border-2 h-10 text-sm font-bold transition-all
                ${isSelected
                  ? `${styles.selected} shadow-sm`
                  : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700"
                }
                ${isMulti ? "border-red-300 dark:border-red-700" : ""}
              `}
            >
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SubjectSection = ({ subject, answers }) => {
  const styles = SUBJECT_STYLES[subject.color];
  const sectionAnswers = answers.filter(
    (a) => a.questionNumber >= subject.start && a.questionNumber <= subject.end
  );

  // Sort by question number
  sectionAnswers.sort((a, b) => a.questionNumber - b.questionNumber);

  // Fill in any missing questions with unattempted placeholders
  const allAnswers = [];
  for (let q = subject.start; q <= subject.end; q++) {
    const found = sectionAnswers.find((a) => a.questionNumber === q);
    allAnswers.push(found || { questionNumber: q, selectedOption: null });
  }

  const attempted = allAnswers.filter(
    (a) => a.selectedOption && a.selectedOption !== "MULTI"
  ).length;
  const unattempted = allAnswers.filter((a) => !a.selectedOption).length;
  const multi = allAnswers.filter((a) => a.selectedOption === "MULTI").length;

  return (
    <div className="mb-8">
      <div className={`${styles.header} rounded-xl px-5 py-3 mb-4 flex items-center justify-between`}>
        <h2 className="text-lg font-bold">{subject.label}</h2>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="bg-white/20 px-2 py-1 rounded-full">✓ {attempted} Attempted</span>
          <span className="bg-white/20 px-2 py-1 rounded-full">○ {unattempted} Skipped</span>
          {multi > 0 && (
            <span className="bg-red-400/50 px-2 py-1 rounded-full">⚠ {multi} Multi</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {allAnswers.map((ans) => (
          <QuestionCard key={ans.questionNumber} ans={ans} subject={subject} />
        ))}
      </div>
    </div>
  );
};

const DetectedAnswers = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detectedAnswers, setDetectedAnswers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetectedAnswers = async () => {
      try {
        const res = await apiClient.get(`/examiner/exam/result/${submissionId}`);
        if (res.data.success) {
          setDetectedAnswers(res.data.detectedMarks || []);
        } else {
          setError(res.data.message || "Failed to fetch answers");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load detected answers. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) fetchDetectedAnswers();
  }, [submissionId]);

  const totalAttempted = detectedAnswers.filter(
    (a) => a.selectedOption && a.selectedOption !== "MULTI"
  ).length;
  const totalUnattempted = detectedAnswers.filter((a) => !a.selectedOption).length;
  const totalMulti = detectedAnswers.filter((a) => a.selectedOption === "MULTI").length;

  return (
    <div className="max-w-7xl mx-auto mt-8 px-4 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Your OMR Response Sheet</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          All 200 questions with your detected answers are shown below
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-lg">Scanning your OMR sheet...</p>
        </div>
      ) : error ? (
        <div className="text-center py-24">
          <p className="text-red-500 text-lg font-semibold mb-4">{error}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">{totalAttempted}</div>
              <div className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mt-1">Attempted</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-500">{totalUnattempted}</div>
              <div className="text-sm text-gray-500 font-medium mt-1">Skipped</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-500">{totalMulti}</div>
              <div className="text-sm text-red-600 dark:text-red-400 font-medium mt-1">Multi-Marked</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-xs">A</div>
              <span className="text-gray-600 dark:text-gray-300">Selected answer</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 font-bold text-xs">B</div>
              <span className="text-gray-600 dark:text-gray-300">Not selected</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">⚠ Multiple Marked</span>
              <span className="text-gray-600 dark:text-gray-300">Invalid — multiple bubbles filled</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Unattempted</span>
              <span className="text-gray-600 dark:text-gray-300">No bubble filled</span>
            </div>
          </div>

          {/* Questions by subject */}
          {SUBJECTS.map((subject) => (
            <SubjectSection
              key={subject.label}
              subject={subject}
              answers={detectedAnswers}
            />
          ))}

          {detectedAnswers.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No answers were detected from this OMR sheet.</p>
            </div>
          )}

          {/* Action button */}
          <div className="sticky bottom-6 flex justify-center mt-6">
            <Button
              size="lg"
              className="px-10 shadow-xl"
              onClick={() => navigate(`/ai-examiner/result/${submissionId}`)}
            >
              View Full Result & Score →
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default DetectedAnswers;
