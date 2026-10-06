import { expect, test, type Page } from "@playwright/test";
import { createFirstProfile } from "./helpers";

async function openKuku(page: Page) {
  await createFirstProfile(page);
  await page.getByRole("navigation", { name: "かもく" }).getByRole("link", { name: "くく" }).click();
  await expect(page).toHaveURL(/\/kuku\/$/);
}

async function startPractice(page: Page, dans: number[], order: "じゅんばん" | "バラバラ") {
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await expect(page).toHaveURL(/\/kuku\/select\/$/);
  // 既定で選ばれている 2 のだんを外してから選び直す
  if (!dans.includes(2)) await page.getByRole("button", { name: "2のだん" }).click();
  for (const d of dans.filter((x) => x !== 2)) await page.getByRole("button", { name: `${d}のだん` }).click();
  await page.getByRole("button", { name: order }).click();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/kuku\/quiz\/$/);
}

/** 4 択で回答する(正解 / 誤答の 1 つ目) */
async function answerByChoice(page: Page, correct: boolean) {
  await page.locator(correct ? "[data-testid=choice][data-correct]" : "[data-testid=choice]:not([data-correct])").first().click();
}

/** 出題中の残りの問題をすべて回答する。shouldBeCorrect(i) で、この関数で答える i 問目(0 始まり)の正誤を決める */
async function answerAllKuku(page: Page, shouldBeCorrect: (i: number) => boolean = () => true) {
  for (let i = 0; ; i++) {
    await expect(page.getByTestId("choice")).toHaveCount(4);
    const label = (await page.getByLabel(/もんめ \/ \d+もん$/).getAttribute("aria-label"))!;
    const [, cur, total] = label.match(/^(\d+)もんめ \/ (\d+)もん$/)!.map(Number);
    await answerByChoice(page, shouldBeCorrect(i));
    await expect(page.getByTestId("feedback")).toBeVisible();
    await expect(page.getByTestId("answer-chart")).toBeVisible();
    await page.getByTestId("feedback").click();
    if (cur >= total) break;
  }
  await expect(page).toHaveURL(/\/kuku\/result\/$/);
}

test("科目を切り替えて、三角視算表の全体図から唱えと語呂合わせを見られる(FR-025, FR-026, FR-029, FR-032)", async ({ page }) => {
  await openKuku(page);
  const chart = page.getByTestId("triangle-chart");
  // 36 組 + 1 の段 9 マス。最初はすべて「まだ」
  await expect(chart.locator("[data-cell]")).toHaveCount(45);
  await expect(chart.locator("[data-status=new]")).toHaveCount(45);

  const voice = page.waitForResponse((r) => /\/audio\/kuku\/[0-9a-f]{8}\.m4a$/.test(new URL(r.url()).pathname) && r.ok());
  await chart.getByRole("button", { name: /^7 かける 8 は 56/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("chant")).toHaveText(["しちは ごじゅうろく", "はちしち ごじゅうろく"]);
  await expect(sheet.getByTestId("goro")).toContainText("ごろ(56)ごろ");
  await voice;
  await sheet.getByRole("button", { name: "とじる" }).click();

  // かんじ に戻れる
  await page.getByRole("navigation", { name: "かもく" }).getByRole("link", { name: "かんじ" }).click();
  await expect(page).toHaveURL(/\/home\/$/);
});

test("じゅんばんで 3 のだんを 4 択で解き、全体図に学習中が反映される(FR-027, FR-028, FR-030)", async ({ page }) => {
  await openKuku(page);
  await startPractice(page, [3], "じゅんばん");
  // 暗唱の順で、式の形
  await expect(page.getByTestId("prompt")).toHaveText(/^3×1=\?$/);
  await answerAllKuku(page);
  await expect(page.getByTestId("score")).toHaveText("9 / 9 もん せいかい!");

  await page.getByRole("button", { name: "くくの ホームへ" }).click();
  const chart = page.getByTestId("triangle-chart");
  // 3×1 は 1 の段の列、3×2〜3×9 は三角 2-3, 3-3, 3-4 … 3-9
  await expect(chart.locator("[data-status=learning]")).toHaveCount(9);
  await expect(chart.locator('[data-cell="3-7"]')).toHaveAttribute("data-status", "learning");
});

test("間違えた式と時間がかかった式が ふくしゅう に出て、速く正解すると消える(FR-033)", async ({ page }) => {
  test.setTimeout(60_000);
  await openKuku(page);
  const review = page.getByRole("button", { name: /^🔁 ふくしゅう/ });
  await expect(review).toBeDisabled();

  await startPractice(page, [7, 8], "バラバラ");
  // 1 問目: 時間をかけて正解(4 択は 5 秒を超えると遅い正解)
  await expect(page.getByTestId("choice")).toHaveCount(4);
  await page.waitForTimeout(5300);
  await answerByChoice(page, true);
  await expect(page.getByTestId("feedback")).toHaveText(/つぎは もっと はやく/);
  await page.getByTestId("feedback").click();
  // 残り 9 問: 2 問目だけ間違える
  await answerAllKuku(page, (i) => i !== 0);
  await expect(page.getByTestId("score")).toHaveText("9 / 10 もん せいかい!");
  await expect(page.getByTestId("wrong-list").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("slow-list").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "くくの ホームへ" }).click();
  await expect(review).toBeEnabled();
  await expect(review).toContainText("2");
  await expect(page.getByTestId("triangle-chart").locator("[data-status=review]")).not.toHaveCount(0);

  await review.click();
  await answerAllKuku(page);
  await expect(page.getByTestId("score")).toHaveText("2 / 2 もん せいかい!");
  // 復習対象がなくなったので「もういちど」は出ない
  await expect(page.getByRole("button", { name: "もういちど" })).toHaveCount(0);
  await page.getByRole("button", { name: "くくの ホームへ" }).click();
  await expect(review).toBeDisabled();
});

test("タイムアタックの記録と自己ベスト(FR-011)", async ({ page }) => {
  await openKuku(page);
  await page.getByRole("button", { name: /タイムアタック/ }).click();
  await page.getByRole("button", { name: "ぜんぶ まぜる" }).click();
  // タイムアタックは常にバラバラ(でかた は選ばない)
  await expect(page.getByRole("button", { name: "じゅんばん" })).toHaveCount(0);
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByText("よーい…")).toBeVisible();
  await answerAllKuku(page);
  await expect(page.getByTestId("score")).toHaveText("10 / 10 もん せいかい!");
  await expect(page.getByText(/タイム \d+\.\dびょう/)).toBeVisible();
  await expect(page.getByText("じこベスト こうしん!")).toBeVisible();
});

test("三角と「積から因数」の問題にも答えられる(FR-027)", async ({ page }) => {
  await openKuku(page);
  const seen = new Set<string>();
  // バラバラを何セットか解き、3 形式が出ることを確かめる
  for (let round = 0; round < 4 && seen.size < 3; round++) {
    if (round === 0) await startPractice(page, [6, 7, 8, 9], "バラバラ");
    else await page.getByRole("button", { name: "もういちど" }).click();
    for (let i = 0; i < 10; i++) {
      const section = page.locator("[data-answer]");
      await expect(page.getByTestId("choice")).toHaveCount(4);
      const format = await section.getAttribute("data-format");
      const text = (await page.getByTestId("prompt").textContent()) ?? "";
      seen.add(format === "triangle" ? "triangle" : text.endsWith("=?") ? "expr" : "factor");
      await answerByChoice(page, true);
      await expect(page.getByTestId("feedback")).toHaveText("⭕️ せいかい!");
      await page.getByTestId("feedback").click();
    }
    await expect(page).toHaveURL(/\/kuku\/result\/$/);
  }
  expect(seen).toEqual(new Set(["expr", "triangle", "factor"]));
});

test("音声入力で答えられる。使えなくなったら 4 択に戻る(FR-031, NFR-016)", async ({ page }) => {
  // ブラウザの音声認識の代わり。聞き取りを始めると、そのときの正解(または __speechText)を「認識」する
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      private t: ReturnType<typeof setTimeout> | undefined;
      start() {
        w.__listening = ((w.__listening as number) ?? 0) + 1;
        this.t = setTimeout(() => {
          if (w.__speechError) {
            this.onerror?.({ error: w.__speechError });
            this.onend?.();
            return;
          }
          const answer = document.querySelector("[data-answer]")?.getAttribute("data-answer") ?? "";
          const text = (w.__speechText as string | undefined) ?? answer;
          const alt = Object.assign([{ transcript: text }], { isFinal: true });
          this.onresult?.({ results: [alt] });
          this.onend?.();
        }, 300);
      }
      abort() {
        clearTimeout(this.t);
        this.onend?.();
      }
    }
    // Chromium には接頭辞なしの SpeechRecognition もあり、アプリはそちらを優先する
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
  });
  await openKuku(page);
  await startPractice(page, [9], "じゅんばん");

  await page.getByRole("button", { name: /こえで こたえる/ }).click();
  // 9×1 = 9 を声で答えた扱い
  await expect(page.getByTestId("feedback")).toHaveText("⭕️ せいかい!");
  await expect(page.getByTestId("slot")).toHaveText("9");
  await page.getByTestId("feedback").click();

  // かなで言っても数に直す(9×2 = 18)
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__speechText = "じゅうはち"));
  await expect(page.getByTestId("feedback")).toHaveText("⭕️ せいかい!");
  await page.getByTestId("feedback").click();

  // 数として読み取れなければ聞き直す
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__speechText = "こんにちは"));
  await expect(page.getByText(/もういちど いってね/)).toBeVisible();

  // マイクが使えなくなったら、音声入力をやめて 4 択で答える
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__speechError = "not-allowed"));
  await expect(page.getByText("こえが つかえないので、えらんで こたえてね")).toBeVisible();
  await expect(page.getByRole("button", { name: /こえで こたえる/ })).toHaveAttribute("aria-pressed", "false");
  await answerByChoice(page, true);
  await expect(page.getByTestId("feedback")).toHaveText("⭕️ せいかい!");
});

test("音声認識がないブラウザでは「こえで こたえる」を出さない(NFR-016)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.webkitSpeechRecognition;
    delete w.SpeechRecognition;
  });
  await openKuku(page);
  await startPractice(page, [2], "じゅんばん");
  await expect(page.getByTestId("choice")).toHaveCount(4);
  await expect(page.getByRole("button", { name: /こえで こたえる/ })).toHaveCount(0);
});
