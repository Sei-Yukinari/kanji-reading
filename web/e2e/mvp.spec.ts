import { expect, test } from "@playwright/test";
import { answerAll, createFirstProfile } from "./helpers";

test("初回起動 → プロフィール作成 → れんしゅう 10 問 → 結果・習得状況・メダルに反映", async ({ page }) => {
  await createFirstProfile(page);

  // 3 タップ以内で出題開始(NFR-006): れんしゅう → ステージ
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 1/ }).click();
  await expect(page).toHaveURL(/\/quiz\/$/);
  await expect(page.locator("[data-testid=choice]")).toHaveCount(4);

  await answerAll(page);
  await expect(page.getByTestId("score")).toHaveText("10 / 10 もん せいかい!");
  await expect(page.getByText("はじめの いっぽ")).toBeVisible();
  await expect(page.getByText("まんてん")).toBeVisible();

  // 習得前でも単元選択に学習中の数が出る
  await page.goto("/units/");
  await expect(page.getByRole("button", { name: /ステージ 1/ })).toContainText("れんしゅうちゅう 10");

  await page.goto("/home/");
  await page.getByRole("link", { name: /おぼえた かんじ/ }).click();
  await expect(page.getByTestId("mastery-total")).toContainText("0 / 80");
  await expect(page.getByLabel(/れんしゅうちゅう$/)).toHaveCount(10);

  await page.goto("/medals/");
  await expect(page.getByTestId("medal-count")).toContainText("2 /");

  // 再読み込みしても記録が残り、前回のプロフィールで起動する(FR-017)
  await page.goto("/");
  await expect(page).toHaveURL(/\/home\/$/);
  await expect(page.getByText("たろう")).toBeVisible();
});

test("まちがえた問題が ふくしゅう に出て、正解すると消える(FR-013)", async ({ page }) => {
  await createFirstProfile(page);
  const review = page.getByRole("button", { name: /ふくしゅう/ });
  await expect(review).toBeDisabled();

  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 2/ }).click();
  await answerAll(page, (i) => i >= 3);
  await expect(page.getByTestId("score")).toHaveText("7 / 10 もん せいかい!");
  await expect(page.getByRole("heading", { name: "まちがえた もんだい" })).toBeVisible();

  await page.getByRole("button", { name: "ホームへ" }).click();
  await expect(review).toBeEnabled();
  await expect(review).toContainText("3");
  await review.click();
  await answerAll(page);
  await expect(page.getByTestId("score")).toHaveText("3 / 3 もん せいかい!");
  await page.getByRole("button", { name: "ホームへ" }).click();
  await expect(review).toBeDisabled();
});

test("タイムアタックの記録と自己ベスト(FR-011)", async ({ page }) => {
  await createFirstProfile(page);
  await page.getByRole("button", { name: /タイムアタック/ }).click();
  await expect(page.getByText("よーい…")).toBeVisible();
  await answerAll(page, (i) => i !== 0);
  await expect(page.getByText(/タイム \d+\.\dびょう/)).toBeVisible();
  await expect(page.getByText("じこベスト こうしん!")).toBeVisible();
});

test("「やめる」で中断すると記録は残らない", async ({ page }) => {
  await createFirstProfile(page);
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 1/ }).click();
  await page.locator("[data-testid=choice]:not([data-correct])").first().click();
  await page.getByRole("button", { name: "やめる" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "やめる" }).click();
  await expect(page).toHaveURL(/\/home\/$/);
  await expect(page.getByRole("button", { name: /ふくしゅう/ })).toBeDisabled();
});

test("正誤表示中に「やめる」→「つづける」しても問題が飛ばない", async ({ page }) => {
  await createFirstProfile(page);
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 1/ }).click();
  await page.locator("[data-testid=choice][data-correct]").click();
  await expect(page.getByTestId("feedback")).not.toBeEmpty();
  await page.getByRole("button", { name: "やめる" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "つづける" }).click();
  // ダイアログのタップが背面の「タップで次へ」に伝わると 3 問目へ飛ぶ
  await expect(page.getByRole("list", { name: /もんめ/ })).toHaveAttribute("aria-label", "2もんめ / 10もん");
  await expect(page.getByTestId("feedback")).toBeEmpty();
});

test("プロフィールを追加・切替・削除できる(FR-016)", async ({ page }) => {
  await createFirstProfile(page, "あに");
  await page.getByRole("link", { name: /あに/ }).click();
  await page.getByRole("button", { name: "ついか" }).click();
  await page.getByRole("textbox").fill("いもうと");
  await page.getByRole("button", { name: "アイコン 🐰" }).click();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByRole("link", { name: /いもうと/ })).toBeVisible();

  // 11 文字以上は保存できない
  await page.getByRole("link", { name: "せってい" }).click();
  await page.getByRole("listitem").filter({ hasText: "いもうと" }).getByRole("button", { name: "なおす" }).click();
  await page.getByRole("textbox").fill("あいうえおかきくけこさ");
  await expect(page.getByText("1〜10もじで いれてね")).toBeVisible();
  await expect(page.getByRole("button", { name: "ほぞん" })).toBeDisabled();
  await page.getByRole("link", { name: /もどる/ }).click();

  await page.getByRole("listitem").filter({ hasText: "あに" }).getByRole("button", { name: "けす" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "けす" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "あに" })).toHaveCount(0);
});

test("全学年を選べて、正解の読み上げ音声を取得する(FR-001, FR-009, FR-021)", async ({ page }) => {
  await createFirstProfile(page);
  await expect(page.getByText(/じゅんびちゅう/)).toHaveCount(0);
  await page.getByRole("button", { name: "6ねん" }).click();
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await expect(page.getByRole("heading", { name: "6ねん れんしゅう" })).toBeVisible();
  await page.getByRole("button", { name: /^ステージ 1(?!\d)/ }).click();

  const voice = page.waitForResponse((r) => /\/audio\/6\/[0-9a-f]{12}\.m4a$/.test(new URL(r.url()).pathname) && r.ok());
  await page.locator("[data-testid=choice][data-correct]").click();
  await voice;
  await expect(page.getByRole("button", { name: "よみあげ" })).toBeVisible();
});

test("よみあげを OFF にすると音声を取得しない(FR-010)", async ({ page }) => {
  await createFirstProfile(page);
  await page.getByRole("link", { name: "せってい" }).click();
  await page.getByRole("switch", { name: "よみあげ" }).uncheck();
  await page.goto("/home/");
  const requested: string[] = [];
  page.on("request", (r) => r.url().includes("/audio/") && requested.push(r.url()));
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 1/ }).click();
  await page.locator("[data-testid=choice][data-correct]").click();
  await expect(page.getByTestId("feedback")).not.toBeEmpty();
  await expect(page.getByRole("button", { name: "よみあげ" })).toHaveCount(0);
  expect(requested).toEqual([]);
});

test("せっていで くらい がめん を ON にするとダーク配色になり、再読み込み後も保たれる", async ({ page }) => {
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  // OS がダークでも既定はライト
  await page.emulateMedia({ colorScheme: "dark" });
  await createFirstProfile(page);
  expect(await bg()).toBe("rgb(245, 245, 247)");

  await page.goto("/settings/");
  const toggle = page.getByRole("switch", { name: "くらい がめん" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(await bg()).toBe("rgb(0, 0, 0)");
  await expect(page.locator("meta[name=theme-color]")).toHaveAttribute("content", "#000000");

  await page.goto("/home/");
  expect(await bg()).toBe("rgb(0, 0, 0)");

  await page.goto("/settings/");
  await page.getByRole("switch", { name: "くらい がめん" }).click();
  expect(await bg()).toBe("rgb(245, 245, 247)");
  await page.reload();
  expect(await bg()).toBe("rgb(245, 245, 247)");
});
