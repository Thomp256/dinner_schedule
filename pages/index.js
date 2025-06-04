import { useEffect, useState } from "react";
import { auth, db } from "../firebase"; // firebaseからauthとdbをインポート
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc } from "firebase/firestore";

// --- 定数とヘルパー関数 ---

// 今後7日間の日付配列を生成する関数
function getNext7Days() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const CORRECT_PASSWORD = "KMS1234";
const DAYS = getNext7Days();


// ★ 追加: 初期表示用のアンサーを生成するヘルパー関数
// localStorageのデータと最新の7日間をマージする
const getInitialAnswers = (savedData) => {
  const initialAnswers = {};
  
  DAYS.forEach(day => {
    // 保存されたデータの中に、今日から7日間に含まれる日付のデータがあればそれを使う
    if (savedData && savedData[day] && typeof savedData[day] === 'object') {
      initialAnswers[day] = savedData[day];
    } else {
      // なければ「未定」で初期化する
      initialAnswers[day] = { status: 'undecided', time: '' };
    }
  });

  return initialAnswers;
};

// --- メインコンポーネント ---

export default function Home() {
  // --- State管理 ---
  const [user, setUser] = useState(null);
  const [nickname, setNickname] = useState("");
  const [answers, setAnswers] = useState(() =>
    DAYS.reduce((acc, day) => {
      acc[day] = { status : "undecided", time : "" };
      return acc;
    }, {})
  );
  const [allUsersAnswers, setAllUsersAnswers] = useState([]); // オブジェクトから配列に変更
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true); // データ読み込み中の状態

  // --- useEffectフック ---

  // 1. Firebase匿名認証
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("匿名認証エラー:", error);
          alert("認証に失敗しました。ページをリロードしてください。");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. 認証ユーザーが変わったら、そのユーザーのデータを読み込む
  useEffect(() => {
    if (user) {
      const savedName = localStorage.getItem("nickname");
      if (savedName) setNickname(savedName);

      const savedAnswersJSON = localStorage.getItem(`answers_${user.uid}`);
      const savedAnswers = savedAnswersJSON ? JSON.parse(savedAnswersJSON) : {};

      // ★ 変更点: 上で定義した関数を使って、表示すべき7日間だけを初期化する
      setAnswers(getInitialAnswers(savedAnswers));
      
      fetchAllUsersAnswers();
    }
  }, [user]); // userが変わった時（初回読み込み時）に実行

  // 3. 回答が変更されたときにlocalStorageへ一時保存
  useEffect(() => {
    if (user) {
      localStorage.setItem(`answers_${user.uid}`, JSON.stringify(answers));
    }
  }, [answers, user]);


  // --- データ操作関数 ---

  // 全ユーザーの回答をFirestoreから取得
  const fetchAllUsersAnswers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const allAnswers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsersAnswers(allAnswers);
    } catch (error) {
      console.error("データ取得エラー:", error);
      alert("Firestoreからデータを取得できませんでした");
    } finally {
      setIsLoading(false);
    }
  };

  // 表示名をlocalStorageに保存
  const handleSaveNickname = () => {
    if (!nickname) {
      alert("表示名を入力してください");
      return;
    }
    localStorage.setItem("nickname", nickname);
    alert("表示名を保存しました");
  };

   // 回答内容を変更
   const handleChangeAnswer = (day, status) => {
     setAnswers((prev) => ({
       ...prev,
       // 以前の回答オブジェクト(...prev[day])を維持しつつ、statusプロパティのみ更新
       [day]: { ...prev[day], status: status },
     }));
   };

  // 回答をFirestoreに保存
  const handleSaveAnswersToFirestore = async () => {
    if (!user) {
      alert("ユーザー情報が取得できていません。");
      return;
    }
    if (!nickname) {
      alert("表示名を入力・保存してください");
      return;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        nickname,
        answers,
        updatedAt: new Date().toISOString(),
      });

      alert("予定をサーバーに保存しました！");
      // 保存後、全ユーザーのデータを再取得して表示を更新
      await fetchAllUsersAnswers();
    } catch (error) {
      console.error("Firestore保存エラー:", error);
      alert("保存に失敗しました。");
    }
  };


  // ★【修正】自分のデータをFirestoreから削除
  const handleDeleteMyData = async () => {
    if (!user) {
      alert("ユーザー情報が取得できていません。");
      return;
    }

    const confirmed = confirm("サーバーに保存されたあなたのデータを本当に削除しますか？この操作は元に戻せません。");
    if (!confirmed) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await deleteDoc(userDocRef);
      
      // ★ ローカルの回答もオブジェクト形式で初期化
      const initialAnswers = DAYS.reduce((acc, day) => {
        acc[day] = { status: "undecided", time: "" }; // 文字列からオブジェクトに変更
        return acc;
      }, {});
      setAnswers(initialAnswers);

      alert("データを削除しました。");
      await fetchAllUsersAnswers(); // 表示を更新
    } catch (error) {
      console.error("データ削除エラー:", error);
      alert("データの削除に失敗しました。");
    }
  };


  // --- レンダリング ---

  // パスワード入力画面
  if (!isLoggedIn) {
    return (
      <div className="p-4">
        <h1 className="text-xl mb-4">パスワードを入力してください</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setIsLoggedIn(password === CORRECT_PASSWORD)}
          className="border px-2 py-1 mr-2"
        />
        <button
          onClick={() => setIsLoggedIn(password === CORRECT_PASSWORD)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          ログイン
        </button>
      </div>
    );
  }



  // 表示用の記号とスタイルに変換
  const formatAnswer = (answerObject) => {
    // answerObjectが未定義またはstatusプロパティを持たない場合に対応
    const status = answerObject?.status || 'undecided';

    const map = {
      eat_early: { symbol: "〇", className: "text-green-500 dark:text-green-400" },
      eat_late:  { symbol: "◇", className: "text-blue-500 dark:text-blue-400" },
      not_eat:   { symbol: "×", className: "text-red-500 dark:text-red-400" },
      undecided: { symbol: "△", className: "text-yellow-500 dark:text-yellow-400" },
      awa:       { symbol: "-",  className: "text-gray-700 dark:text-gray-300" },
    };
    // 不明なステータスの場合のデフォルト値
    return map[status] || { symbol: "?", className: "text-gray-400" };
  };
   
  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">ようこそ！夕飯予定アプリ</h1>

      {/* 表示名設定 */}
      <div className="mb-4 p-4 border rounded">
        <label className="block font-bold mb-2">表示名設定</label>
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
        <p className="text-sm text-gray-600 mt-1">※最初に表示名を設定・保存してください。</p>
      </div>

      {/* 自分の予定入力 */}
      <div className="mb-4 p-4 border rounded">
        <h2 className="text-lg mb-2">今後7日間の夕飯予定</h2>
        {DAYS.map((day) => (
          <div key={day} className="mb-2">
            <span className="mr-4 inline-block w-24">{day}</span>
            <select
              // ★ valueをanswers[day]オブジェクトのstatusプロパティに設定
              value={answers[day]?.status || "undecided"}
              onChange={(e) => handleChangeAnswer(day, e.target.value)}
              className="border px-2 py-1"
            >
              <option value="undecided">未定</option>
              <option value="eat_early">食べる(21:00以前)</option>
              <option value="eat_late">食べる(21:00以降)</option>
              <option value="not_eat">食べない</option>
              <option value="awa">阿波踊り</option>
            </select>
          </div>
        ))}
      </div>
      
      {/* 操作ボタン */}
      <div className="flex space-x-2 my-4">
        <button
          onClick={handleSaveAnswersToFirestore}
          className="bg-blue-500 text-white px-4 py-2 rounded flex-grow"
        >
          サーバーに予定を保存する
        </button>
        <button
          onClick={handleDeleteMyData}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          自分のデータを削除
        </button>
      </div>

    {/* みんなの予定表示 */}
    <div className="mt-6">
      <h2 className="text-lg mb-2">
        みんなの夕飯予定 (
        <span className="text-green-500 dark:text-green-400 font-bold">〇</span>:21時前{' '}
        <span className="text-blue-500 dark:text-blue-400 font-bold">◇</span>:21時後{' '}
        <span className="text-red-500 dark:text-red-400 font-bold">×</span>:食べない{' '}
        <span className="text-gray-700 dark:text-gray-300 font-bold">-</span>:阿波踊り{' '}
        <span className="text-yellow-500 dark:text-yellow-400 font-bold">△</span>:未定
        )
      </h2>
      
      {/* テーブルのヘッダー部分 (md以上の画面でのみ表示) */}
      <div className="hidden md:grid md:grid-cols-8 md:gap-x-2 font-bold p-2 bg-gray-100 dark:bg-gray-800 rounded-t-lg">
        <div className="col-span-1">表示名</div>
        {DAYS.map((day) => (
          <div key={day} className="text-center">{day.slice(5)}</div>
        ))}
      </div>

      {/* テーブルのボディ部分 (ユーザーデータのループ) */}
      <div className="space-y-4 md:space-y-0">
        {isLoading ? <p>読み込み中...</p> : allUsersAnswers.map((userData) => (
          <div key={userData.id} className="border rounded-lg p-3 md:border-t-0 md:rounded-none md:p-0 md:grid md:grid-cols-8 md:gap-x-2 md:items-center hover:bg-gray-50 dark:hover:bg-gray-700">
            
            <div className="font-bold text-lg md:text-base md:p-2 col-span-1">
              {userData.nickname}
            </div>

            <div className="grid grid-cols-4 gap-2 mt-2 md:col-span-7 md:grid-cols-7 md:mt-0">
              {DAYS.map((day) => {
                // ★ formatAnswerの結果を一旦変数に格納
                const formatted = formatAnswer(userData.answers[day]);
                return (
                  <div key={day} className="text-center p-1 rounded-md bg-gray-100 dark:bg-gray-700 md:bg-transparent md:dark:bg-transparent">
                    <div className="text-xs text-gray-500 dark:text-gray-400 md:hidden">{day.slice(5)}</div>
                    {/* ★ classNameに動的なクラスを追加し、記号を表示 */}
                    <div className={`text-lg font-mono ${formatted.className}`}>
                      {formatted.symbol}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>

    </div>
  );
}
