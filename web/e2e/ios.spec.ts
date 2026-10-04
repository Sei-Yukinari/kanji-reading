import { expect, test } from "@playwright/test";
import { answerAll } from "./helpers";

test("iOS の Safari タブで初回起動すると、ホーム画面追加の案内を先に表示する(FR-017, FR-020)", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/install\/$/);
  await expect(page.getByText("iPhone・iPadの ばあい")).toBeVisible();
  await page.getByRole("button", { name: "あとで" }).click();
  await expect(page).toHaveURL(/\/profile-edit\/$/);
  await page.getByRole("textbox").fill("あいふぉん");
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByRole("button", { name: /れんしゅう/ }).click();
  await page.getByRole("button", { name: /ステージ 4/ }).click();
  await answerAll(page);
  await expect(page.getByTestId("score")).toHaveText("10 / 10 もん せいかい!");
});
