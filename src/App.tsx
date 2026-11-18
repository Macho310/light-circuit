import { useEffect } from "react";
import { mountGame } from "./game.js";

const gameMarkup = "<main><header><div><h1>灯りの回路 <span id=\"number\"></span></h1></div><div class=\"actions\"><button id=\"answer\">答えを表示</button><button id=\"new\">新しい問題</button></div></header><div id=\"workspace\"><svg id=\"board\" viewBox=\"0 0 600 600\" aria-label=\"回路盤面。ピースをドラッグして配置し、クリックして回転。\"></svg><div id=\"tray\" aria-label=\"部品置き場。ここへドラッグして戻せます。\"></div></div><div id=\"status\" role=\"status\" aria-live=\"polite\" class=\"empty\"></div><p>盤面にある電球も含め、5個の電球を目標電流に合わせます。ピースの形は問題ごとに変わります。ドラッグで配置・移動 ／ クリックで90°回転（端では自動調整） ／ 盤外へ戻す。</p><p class=\"subnote\">固定の線は太い実線、ピースの線は細い破線。同じ電位の配線は同色。接続は線で確認。電位は電池の−側を0Vとし、定まらない部分は「電位未定」と表示。ピースは固定配線を切りません。●はピース同士で共有できる接続点です。同じ●では分岐・合流し、部品は一時的に重ねて置けます。赤い「!」の区間が重なりです。固定導線との重なりも警告の対象です。重なりを解消するとクリア判定できます。電流は左下が現在値、電球の右下が目標値。分数で表示し、ピースの矢印で向きを示します。</p></main><div id=\"ghost\" hidden></div>";

export default function App() {
  useEffect(() => mountGame(), []);
  return <div dangerouslySetInnerHTML={{ __html: gameMarkup }} />;
}
