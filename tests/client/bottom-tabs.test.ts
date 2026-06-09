import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BottomTabs } from "../../src/client/components/BottomTabs";

describe("BottomTabs", () => {
  test("shows yesterday as a primary admin navigation tab", () => {
    const html = renderToStaticMarkup(createElement(BottomTabs, { activePath: "/app/yesterday", onNavigate: () => undefined }));

    expect(html).toContain('<a href="/app/yesterday" class="active">Yesterday</a>');
  });
});
