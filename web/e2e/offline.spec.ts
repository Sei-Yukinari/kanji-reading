import { expect, test } from "@playwright/test";

test("一度読み込んだ後はオフラインでも学習できる(FR-019)", async ({ page, context }) => {
  await page.goto("/");
  // Service Worker が precache を終えてページを制御するまで待つ
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/profile-edit\/$/);
  await page.getByRole("textbox").fill("オフライン");
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 3/ }).click();
  await expect(page.locator("[data-testid=choice]")).toHaveCount(4);

  // 存在しない URL も起動画面経由でホームへ
  await page.goto("/no-such-page/");
  await expect(page).toHaveURL(/\/home\/$/);
});

test("九九はオフラインでも 4 択で学習でき、唱えの音声も鳴らせる(FR-019, FR-029, NFR-016)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
  await page.getByRole("textbox").fill("くく");
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/home\/$/);
  // 九九ホームを開くと、唱えの音声 81 本を取得して端末に保存する
  await page.goto("/kuku/");
  await expect
    .poll(async () => page.evaluate(async () => (await (await caches.open("audio")).keys()).filter((r) => r.url.includes("/audio/kuku/")).length), { timeout: 30_000 })
    .toBe(81);

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page.getByTestId("choice")).toHaveCount(4);
  // オフラインでは音声入力を出さない
  await expect(page.getByRole("button", { name: /こえで こたえる/ })).toHaveCount(0);
  const voice = page.waitForResponse((r) => r.url().includes("/audio/kuku/") && r.ok());
  await page.locator("[data-testid=choice][data-correct]").click();
  await expect(page.getByTestId("feedback")).toHaveText("⭕️ せいかい!");
  await voice;
});
