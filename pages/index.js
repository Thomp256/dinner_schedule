import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react";

function getNext7Days() {
  const days = [];
  const today = new Date();
  
  for(let i = 0; i < 7; i++){
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0,10));
  }
  
  return days;
}

const CORRECT_PASSWORD = "KMS1234";
const days = getNext7Days();

export default function Home() {

  // 日ごとのデータ保存
  const [answers, setAnswers] = useState(() =>
    days.reduce((acc,day) => {
      acc[day] = "undecided";
      return acc;
    }, {})
  );
  
  // 回答データをlocalStorageから読み込む
  useEffect(() => {
    const savedAnswers = localStorage.getItem("answers");
    if (savedAnswers) {
      setAnswers(JSON.parse(savedAnswers));
    }
  }, []);

  // 回答が変更されたときにlocalStorageへ保存
  useEffect(() => {
    localStorage.setItem("answers", JSON.stringify(answers));
  }, [answers]);
  
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  const [allUsersAnswers, setAllUsersAnswers] = useState({});
  
  const handleLogin = () => {
    if (password === CORRECT_PASSWORD) {
      setIsLoggedIn(true);
    } else {
      alert("パスワードが間違っています");
    }
  };
  
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("nickname");
    if (savedName) {
      setNickname(savedName);
    }
  }, []);
  
  // 保存ボタン
  const handleSaveNickname = () => {
    localStorage.setItem("nickname", nickname);
    alert("表示名を保存しました");
  }
  
  // 回答をセット
  const handleChange = (day, value) => {
    setAnswers((prev) => ({ ...prev, [day]: value }));
  };
  
  // 回答を保存
  const handleSaveAnswers = () => {
    if (!nickname) {
      alert("表示名を入力してください");
      return;
    }
    
    
    // 表示名を保存
    localStorage.setItem("nickname", nickname);
    

    const allAnswers = JSON.parse(localStorage.getItem("allAnswers") || "{}");

    allAnswers[nickname] = {
      answers,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem("allAnswers", JSON.stringify(allAnswers));
    
    setAllUsersAnswers(allAnswers);
    alert("保存しました！");
  };
    
    const handleDeleteMyData = () => {
      if (!nickname) {
        alert("表示名を入力してください");
        return;
      }

      const allAnswers = JSON.parse(localStorage.getItem("allAnswers") || "{}");

      if (!allAnswers[nickname]) {
        alert(`${nickname} さんのデータは見つかりませんでした`);
        return;
      }

      const confirmed = confirm(`${nickname} さんのデータを本当に削除しますか？`);
      if (!confirmed) return;

      delete allAnswers[nickname];
      localStorage.setItem("allAnswers", JSON.stringify(allAnswers));
      alert(`${nickname} さんのデータを削除しました`);

      // 表示を更新
      setAllUsersAnswers(allAnswers);
    };

  
  useEffect(() => {
    const stored = localStorage.getItem("allAnswers");
    if (stored) {
      setAllUsersAnswers(JSON.parse(stored));
    }
  }, []);
  
  
  if (!isLoggedIn) {
    return (
      <div className="p-4">
        <h1 className="text-xl mb-4">パスワードを入力してください</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          ログイン
        </button>
      </div>
    );
  }
  
  // 表示用
  const formatAnswer = (value) => {
    if (value === "eat_early") return "〇";
    if (value === "eat_late") return "◇";
    if (value === "not_eat") return "×";
    if (value === "undecided") return "△";
    if (value === "awa") return "-";
    return "";
  };
  
  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">ようこそ！夕飯予定アプリ</h1>

      <div className="mb-4">
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="表示名を入力"
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={handleSaveNickname}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          表示名を保存
        </button>

        <button
          onClick={handleDeleteMyData}
          className="bg-red-500 text-white px-4 py-2 rounded ml-2"
        >
          自分のデータを削除する
        </button>

      </div>

      <div>
        <h2 className="text-lg mb-2">今後7日間の夕飯予定</h2>
        {days.map((day) => (
          <div key={day} className="mb-2">
            <span className="mr-4">{day}</span>
            <select
              value={answers[day]}
              onChange={(e) => handleChange(day, e.target.value)}
              className="border px-2 py-1"
            >
              <option value="eat_early">食べる(21:00以前)</option>
              <option value="eat_late">食べる(21:00以降)</option>
              <option value="not_eat">食べない</option>
              <option value="awa">阿波踊り</option>
              <option value="undecided">未定</option>
            </select>
          </div>
        ))}
      </div>
            
      <div>
        <button
          onClick={handleSaveAnswers}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          予定を保存する
        </button>
      </div>
            
      <div className="mt-6">
        <h2 className="text-lg mb-2">みんなの夕飯予定(〇=21:00以前,◇=21:00以後,×=食べない,-=阿波踊り,△=未定)</h2>
        <table className="table-auto border-collapse border border-gray-400">
          <thead>
            <tr>
              <th className="border border-gray-300 px-2 py-1">表示名</th>
              {days.map((day) => (
                <th key={day} className="border border-gray-300 px-2 py-1">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(allUsersAnswers).map(([name, data]) => (
              <tr key={name}>
                <td className="border border-gray-300 px-2 py-1 font-bold">{name}</td>
                {days.map((day) => {
                  const val = data.answers[day];
                  return (
                    <td key={day} className="border border-gray-300 px-2 py-1 text-center">
                      {formatAnswer(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>

  );
}
