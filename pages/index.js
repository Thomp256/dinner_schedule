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
      // localStorageからニックネームを読み込む
      const savedName = localStorage.getItem("nickname");
      if (savedName) setNickname(savedName);

      // localStorageから未保存の回答を読み込む
      const savedAnswers = localStorage.getItem(`answers_${user.uid}`);
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      
      // Firestoreから全ユーザーのデータを取得
      fetchAllUsersAnswers();
    }
  }, [user]);

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
  const handleChangeAnswer = (day, value) => {
    setAnswers((prev) => ({ ...prev, [day]: value }));
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
        
        // ローカルの回答も初期化
        const initialAnswers = DAYS.reduce((acc, day) => {
          acc[day] = "undecided";
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

  // 表示用の記号に変換
  const formatAnswer = (value) => {
    const map = {
      eat_early: "〇",
      eat_late: "◇",
      not_eat: "×",
      undecided: "△",
      awa: "-",
    };
    return map[value] || "";
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
              value={answers[day]}
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
        <h2 className="text-lg mb-2">みんなの夕飯予定 (〇:21時前 ◇:21時後 ×:食べない -:阿波踊り △:未定)</h2>
        
        {/* テーブルのヘッダー部分 (md以上の画面でのみ表示) */}
        <div className="hidden md:grid md:grid-cols-8 md:gap-x-2 font-bold p-2 bg-gray-100 rounded-t-lg">
          <div className="col-span-1">表示名</div>
          {DAYS.map((day) => (
            <div key={day} className="text-center">{day.slice(5)}</div> // 日付を短縮 (MM-DD)
          ))}
        </div>

        {/* テーブルのボディ部分 (ユーザーデータのループ) */}
        <div className="space-y-4 md:space-y-0">
          {isLoading ? <p>読み込み中...</p> : allUsersAnswers.map((userData) => (
            // --- ここからがレスポンシブ対応のキモ ---
            // スマホではカード、PCではグリッドの行になる
            <div key={userData.id} className="border rounded-lg p-3 md:border-t-0 md:rounded-none md:p-0 md:grid md:grid-cols-8 md:gap-x-2 md:items-center hover:bg-gray-50">
              
              {/* ユーザー名 */}
              <div className="font-bold text-lg md:text-base md:p-2 col-span-1">
                {userData.nickname}
              </div>

              {/* 7日間の予定 (スマホでは縦、PCでは横に並ぶ) */}
              {/* スマホ用にgridでレイアウト */}
              <div className="grid grid-cols-4 gap-2 mt-2 md:col-span-7 md:grid-cols-7 md:mt-0">
                {DAYS.map((day) => (
                  <div key={day} className="text-center p-1 rounded-md bg-gray-100 md:bg-transparent">
                    {/* スマホ用に日付を表示 */}
                    <div className="text-xs text-gray-500 md:hidden">{day.slice(5)}</div>
                    <div className="text-lg font-mono">{formatAnswer(userData.answers[day])}</div>
                  </div>
                ))}
              </div>

            </div>
            // --- ここまで ---
          ))}
        </div>
      </div>

    </div>
  );
}
