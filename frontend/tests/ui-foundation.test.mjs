import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("UI primitives preserve native form contracts and render accessible, escaped feedback", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: "node_modules/.tmp/ssr-ui-foundation",
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  try {
    const load = (name) => server.ssrLoadModule(`/src/components/ui/${name}.tsx`);
    const [
      { Button },
      { Input },
      { Select },
      { Badge },
      { LoadingState },
      { EmptyState },
      { ErrorState },
      table,
    ] = await Promise.all(
      [
        "Button",
        "Input",
        "Select",
        "Badge",
        "LoadingState",
        "EmptyState",
        "ErrorState",
        "Table",
      ].map(load),
    );
    const render = (component, props, ...children) =>
      renderToStaticMarkup(h(component, props, ...children));
    for (const variant of ["primary", "secondary", "ghost", "danger"]) {
      const html = render(Button, { variant }, "Action");
      assert.match(html, /type="button"/);
      assert.match(html, /data-slot="button"/);
      const expected =
        variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant;
      assert.match(html, new RegExp(`data-variant="${expected}"`));
    }
    const busy = render(Button, { loading: true, type: "submit" }, "Đang gửi");
    assert.match(busy, /disabled=""/);
    assert.match(busy, /aria-busy="true"/);
    assert.match(busy, /type="submit"/);
    assert.match(render(Button, { disabled: true }, "Action"), /disabled=""/);
    const onChange = () => {},
      onBlur = () => {},
      ref = () => {};
    const inputProps = {
      id: "query",
      name: "q",
      onChange,
      onBlur,
      ref,
      "aria-invalid": true,
      "aria-describedby": "q-error",
      readOnly: true,
      defaultValue: "<script>",
    };
    const input = render(Input, inputProps);
    for (const attr of [
      'id="query"',
      'name="q"',
      'aria-invalid="true"',
      'aria-describedby="q-error"',
      'readOnly=""',
      'value="&lt;script&gt;"',
    ])
      assert.ok(input.includes(attr), attr);
    // Native handlers and register() ref pass through the function component unchanged.
    const element = Input(inputProps);
    assert.equal(element.props.onChange, onChange);
    assert.equal(element.props.onBlur, onBlur);
    assert.equal(element.props.ref, ref);
    const searchProps = { ...inputProps, type: "search", maxLength: 500 };
    const searchElement = Input(searchProps);
    const searchInput = searchElement.props.children[1];
    assert.equal(searchInput.props.onChange, onChange);
    assert.equal(searchInput.props.onBlur, onBlur);
    assert.equal(searchInput.props.ref, ref);
    assert.equal(searchInput.props.maxLength, 500);
    const searchHtml = render(Input, searchProps);
    assert.match(searchHtml, /type="search"/);
    assert.match(searchHtml, /SearchOutlinedIcon/);
    assert.doesNotMatch(searchHtml, /<script>/);
    const { Textarea } = await load("primitives/textarea");
    const textareaProps = {
      name: "note",
      onChange,
      onBlur,
      ref,
      maxLength: 10000,
      disabled: true,
      defaultValue: "  Nội dung\n<script>  ",
      "aria-describedby": "note-error",
    };
    const textarea = Textarea(textareaProps);
    assert.equal(textarea.props.onChange, onChange);
    assert.equal(textarea.props.onBlur, onBlur);
    assert.equal(textarea.props.ref, ref);
    const textareaHtml = render(Textarea, textareaProps);
    assert.match(textareaHtml, /data-slot="textarea"/);
    assert.match(textareaHtml, /maxLength="10000"/);
    assert.match(textareaHtml, /disabled=""/);
    assert.match(textareaHtml, /  Nội dung\n&lt;script&gt;  /);
    const selectProps = {
      name: "source",
      onChange,
      onBlur,
      ref,
      disabled: true,
      defaultValue: "a",
      children: h("option", { value: "a" }, "Source A"),
    };
    const select = render(Select, selectProps);
    assert.match(select, /name="source"/);
    assert.match(select, /disabled=""/);
    assert.match(select, /selected=""/);
    assert.equal(Select(selectProps).props.ref, ref);
    for (const tone of ["neutral", "info", "success", "warning", "danger"]) {
      const badge = render(Badge, { tone }, "Status");
      assert.match(badge, /data-slot="badge"/);
      assert.match(badge, /border-0/);
      assert.match(badge, /bg-transparent/);
      assert.match(badge, /Status/);
    }
    assert.match(render(LoadingState, { message: "Loading" }), /role="status"/);
    assert.match(
      render(EmptyState, {
        title: "Empty",
        description: "Nothing yet",
        action: h(Button, null, "Refresh"),
      }),
      /Nothing yet/,
    );
    const error = render(ErrorState, {
      message: "<script>unsafe</script>",
      requestId: "request-a",
      action: h(Button, null, "Try again"),
    });
    assert.match(error, /role="alert"/);
    assert.match(error, /request-a/);
    assert.match(error, /Try again/);
    assert.doesNotMatch(error, /<script>/);
    const html = render(
      table.Table,
      { caption: "Sources" },
      h(table.TableHeader, null, h(table.TableRow, null, h(table.TableHead, null, "Name"))),
      h(table.TableBody, null, h(table.TableRow, null, h(table.TableCell, null, "<source>"))),
    );
    assert.match(html, /tabindex="0"/);
    assert.match(html, /role="region" aria-label="Sources"/);
    assert.doesNotMatch(html, /<caption/);
    assert.match(html, /aria-label="Sources"/);
    assert.match(html, /<th[^>]*scope="col"[^>]*>Name<\/th>/);
    assert.match(html, /&lt;source&gt;/);
    assert.match(html, /data-slot="table"/);
    const { cn } = await server.ssrLoadModule("/src/lib/utils.ts");
    assert.equal(cn("px-2", { hidden: false }, "px-4"), "px-4");
    assert.match(render(LoadingState, { message: "Loading" }), /data-slot="skeleton"/);
    assert.match(render(EmptyState, { title: "Empty" }), /data-slot="empty"/);
    assert.match(error, /data-slot="alert"/);
    const longMessage = "Thông báo tiếng Việt rất dài cần được đọc đầy đủ. ".repeat(20);
    const longError = render(ErrorState, { message: longMessage });
    assert.ok(longError.includes(longMessage));
    assert.match(longError, /line-clamp-none/);
    assert.match(render(LoadingState, { message: longMessage }), /role="status"/);
    assert.ok(render(EmptyState, { title: longMessage }).includes(longMessage));
  } finally {
    await server.close();
  }
});
