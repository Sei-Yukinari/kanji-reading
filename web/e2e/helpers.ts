import { expect, type Page } from "@playwright/test";

export async function createFirstProfile(page: Page, nickname = "たろう") {
  await page.goto("/");
  await expect(page).toHaveURL(/\/profile-edit\/$/);
  await page.getByRole("textbox").fill(nickname);
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/home\/$/);
}

/** 出題中の問題をすべて回答する。shouldBeCorrect(i) で i 問目の正誤を決める */
export async function answerAll(page: Page, shouldBeCorrect: (i: number) => boolean = () => true) {
  for (let i = 0; ; i++) {
    const choice = page.locator("[data-testid=choice]:not([disabled])");
    await expect(choice.first()).toBeVisible();
    const total = Number((await page.getByRole("list", { name: /もんめ/ }).getAttribute("aria-label"))!.match(/\/ (\d+)もん/)![1]);
    const target = shouldBeCorrect(i)
      ? page.locator("[data-testid=choice][data-correct]")
      : page.locator("[data-testid=choice]:not([data-correct])").first();
    await target.click();
    await expect(page.getByTestId("feedback")).not.toBeEmpty();
    // 正誤表示中は画面タップで次へ進める(FR-007)
    await page.getByTestId("prompt").click();
    if (i + 1 >= total) break;
  }
  await expect(page).toHaveURL(/\/result\/$/);
}
