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
