import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const vocabularyData = [
  {
    day: 1,
    words: [
      { word: "hobby", meaning: "취미" },
      { word: "piano", meaning: "피아노" },
      { word: "sing", meaning: "노래하다" },
      { word: "draw", meaning: "(그림을) 그리다" },
      { word: "dance", meaning: "춤추다" },
      { word: "paint", meaning: "칠하다" },
      { word: "watch", meaning: "보다" },
      { word: "picture", meaning: "사진, 그림" },
      { word: "movie", meaning: "영화" },
      { word: "diary", meaning: "일기" },
    ],
  },
];

export default function VocabularyApp() {
  const [currentDay, setCurrentDay] = useState(1);

  const handleNextDay = () => {
    if (currentDay < vocabularyData.length) {
      setCurrentDay(currentDay + 1);
    }
  };

  const handlePreviousDay = () => {
    if (currentDay > 1) {
      setCurrentDay(currentDay - 1);
    }
  };

  const currentWords = vocabularyData.find((data) => data.day === currentDay)?.words || [];

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-center mb-4">Day {currentDay} Vocabulary</h1>
      <div className="grid gap-4">
        {currentWords.map((wordObj, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <p className="text-lg font-semibold">{wordObj.word}</p>
              <p className="text-gray-500">{wordObj.meaning}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-between mt-4">
        <Button onClick={handlePreviousDay} disabled={currentDay === 1}>Previous</Button>
        <Button onClick={handleNextDay} disabled={currentDay === vocabularyData.length}>Next</Button>
      </div>
    </div>
  );
}
