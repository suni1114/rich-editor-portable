# RichEditor — 이식용 리치 텍스트 에디터 (React + Quill 2)

한강미디어 제품/게시판 등록에서 쓰는 본문 에디터입니다. **다른 홈페이지(React 프로젝트)에 그대로 복사**해서 쓸 수 있도록 전체 소스·의존성·사용법·읽기 렌더링까지 담았습니다.

---

## 1. 기능 요약

- **서식**: 서체(기본/맑은고딕/돋움/굴림/바탕), 글자 크기(12~32px), 굵게·기울임·밑줄·취소선, 글자색·배경색, 정렬(좌/중/우/양쪽), 글머리/번호 목록, 인용구, 링크, 구분선(hr), 되돌리기/다시실행
- **사진**: 여러 장 동시 업로드 → 순서대로 삽입 (본문 이미지는 URL로 HTML에 포함)
- **동영상**: ① 파일 업로드(진행바 표시 → `<video>` 재생) ② 링크 삽입(YouTube/Vimeo → iframe 임베드)
- **파일**: 첨부 → 파일명·용량 카드
- **표**: 8×8 그리드로 삽입, 선택 시 아이콘 툴바(행/열 삽입·삭제, 좌/중/우 정렬, 삭제) + 모서리 점 드래그로 가로·세로 비율 리사이즈
- **본문 항목 선택/삭제**: 이미지·영상·파일 카드 클릭 선택 후 Delete/Backspace
- **아이콘 호버 툴팁**, 서체/크기 드롭다운 바깥 클릭 시 닫힘

에디터는 **인라인 style 기반 포맷**(size/font/color/background/align)을 사용하므로, 저장된 HTML을 에디터 밖(상세 페이지)에서 그대로 렌더해도 서식이 유지됩니다.

값(`value`)과 변경(`onChange`)은 **HTML 문자열**로 주고받습니다. 이 HTML을 DB에 저장하고, 상세 페이지에서 sanitize 후 렌더하면 됩니다.

---

## 2. 의존성 설치

```bash
npm install react-quill-new quill dompurify
```

검증된 버전 (한강미디어 기준):

| 패키지 | 버전 |
|---|---|
| react | ^18.3.1 |
| react-quill-new | ^3.8.3 |
| quill | 2.0.3 (react-quill-new 의존으로 자동 설치) |
| dompurify | ^3.4.11 (상세 페이지 렌더용) |

> `react-quill-new`는 Quill 2 호환 포크입니다. 구형 `react-quill`(Quill 1)과는 API가 다르니 **`react-quill-new`를 사용**하세요. `quill/modules/table`, `quill/formats/video` 서브패스를 직접 import 하므로 Vite/CRA/Next 어디서든 번들러가 해당 파일을 찾을 수 있어야 합니다(quill 2.0.x는 `exports` 필드가 없어 서브패스 직접 접근이 됩니다).

---

## 3. 필요한 CSS 변수

컴포넌트 CSS가 아래 전역 변수를 사용합니다. 프로젝트 `:root`에 없다면 정의하세요(값은 예시, 자유 조정).

```css
:root{
  --color-primary:#10233F;      /* 강조/포커스 */
  --color-text:#1f2937;         /* 본문 글자 */
  --color-muted:#6b7280;        /* 보조 텍스트 */
  --color-border:#e2e5e9;       /* 테두리 */
  --color-accent-soft:#e7ecf5;  /* 표 그리드 hover (없으면 fallback #e7ecf5 사용) */
}
```

---

## 4. 사용법

```jsx
import { useState } from "react";
import RichEditor from "./RichEditor.jsx";

export default function WritePage() {
  const [body, setBody] = useState("");   // HTML 문자열

  // 업로드 핸들러 3종 — 서버에 올리고 "공개 URL 문자열"을 반환하면 됩니다.
  const onImageUpload = async (file) => {
    const url = await myUpload(file);     // 프로젝트 업로드 API
    return url;                           // 실패 시 null 반환 → 삽입 생략
  };
  const onFileUpload = async (file) => {
    return await myUpload(file);
  };
  // 동영상은 진행률 콜백(onProgress: 0~100) 지원. 반환은 재생 가능한 영상 URL.
  const onVideoUpload = (file, onProgress) => myUploadWithProgress(file, onProgress);

  return (
    <RichEditor
      value={body}
      onChange={setBody}
      onImageUpload={onImageUpload}
      onFileUpload={onFileUpload}
      onVideoUpload={onVideoUpload}
    />
  );
}
```

### Props

| prop | 타입 | 설명 |
|---|---|---|
| `value` | `string` | 에디터 HTML (제어 컴포넌트) |
| `onChange` | `(html: string) => void` | 내용 변경 시 HTML 반환 |
| `onImageUpload` | `(file: File) => Promise<string \| null>` | 이미지 업로드 → 공개 URL |
| `onFileUpload` | `(file: File) => Promise<string \| null>` | 첨부파일 업로드 → 공개 URL |
| `onVideoUpload` | `(file: File, onProgress?: (pct:number)=>void) => Promise<string \| null>` | 동영상 업로드(진행률) → 재생 URL |

> 세 업로드 핸들러는 **선택**입니다. 넘기지 않으면 해당 버튼이 동작만 안 하고 에러는 없습니다.

### 지연 로딩(권장)

Quill 번들이 크므로 코드 스플리팅을 권장합니다.

```jsx
import { lazy, Suspense } from "react";
const RichEditor = lazy(() => import("./RichEditor.jsx"));
// ...
<Suspense fallback={<p>에디터 불러오는 중...</p>}>
  <RichEditor value={body} onChange={setBody} /* ...핸들러 */ />
</Suspense>
```

---

## 5. 컴포넌트 소스

아래 두 파일을 프로젝트에 그대로 추가하세요. (`RichEditor.jsx` 와 같은 폴더에 `RichEditor.module.css`)

### `RichEditor.jsx`

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import TableModule from "quill/modules/table";
import Video from "quill/formats/video";
import styles from "./RichEditor.module.css";

// 표(테이블) 모듈 · 링크 동영상(iframe) 포맷 등록
Quill.register({ "modules/table": TableModule }, true);
TableModule.register();
Quill.register(Video, true);

// ── 인라인 style 기반 포맷(에디터 밖에서도 그대로 렌더) ──
const SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const FONTS = ["", "Malgun Gothic", "Dotum", "Gulim", "Batang"]; // ""=기본서체
const SizeStyle = Quill.import("attributors/style/size");
SizeStyle.whitelist = SIZES;
Quill.register(SizeStyle, true);
const FontStyle = Quill.import("attributors/style/font");
FontStyle.whitelist = FONTS;
Quill.register(FontStyle, true);
Quill.register(Quill.import("attributors/style/align"), true);
Quill.register(Quill.import("attributors/style/color"), true);
Quill.register(Quill.import("attributors/style/background"), true);

// 구분선(hr) blot
const BlockEmbed = Quill.import("blots/block/embed");
class HrBlot extends BlockEmbed {}
HrBlot.blotName = "hr";
HrBlot.tagName = "hr";
Quill.register(HrBlot);

// 업로드한 동영상 → 래퍼 div + <video> (편집기에선 재생 대신 클릭 선택, 상세에선 재생)
class VideoFileBlot extends BlockEmbed {
  static create(url) {
    const node = super.create();
    node.setAttribute("contenteditable", "false");
    node.className = "eq-video-block";
    node.innerHTML = '<video src="' + esc(url) + '" controls preload="metadata" controlslist="nodownload"></video>';
    return node;
  }
  static value(node) { return node.querySelector("video")?.getAttribute("src") || ""; }
}
VideoFileBlot.blotName = "videofile";
VideoFileBlot.tagName = "div";
Quill.register(VideoFileBlot);

// 첨부 파일 → 파일명·용량 카드
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
class FileCardBlot extends BlockEmbed {
  static create(v) {
    const node = super.create();
    node.setAttribute("href", v.url);
    node.setAttribute("download", v.name || "");
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener");
    node.setAttribute("contenteditable", "false");
    node.className = "eq-file-card";
    node.innerHTML =
      '<span class="eq-file-ico">📄</span>' +
      '<span class="eq-file-meta"><span class="eq-file-name">' + esc(v.name || "파일") + "</span>" +
      '<span class="eq-file-size">' + esc(v.size || "") + "</span></span>";
    return node;
  }
  static value(node) {
    return {
      url: node.getAttribute("href"),
      name: node.getAttribute("download"),
      size: node.querySelector(".eq-file-size")?.textContent || "",
    };
  }
}
FileCardBlot.blotName = "filecard";
FileCardBlot.tagName = "a";
Quill.register(FileCardBlot);

// 동영상 업로드 진행 플레이스홀더 (회색 박스 + 상단 오렌지 진행바)
class VideoUploadingBlot extends BlockEmbed {
  static create(v) {
    const node = super.create();
    node.setAttribute("contenteditable", "false");
    node.className = "eq-video-uploading";
    node.dataset.uid = v.id || "";
    node.innerHTML =
      '<div class="eq-vu-bar"><div class="eq-vu-fill" style="width:0%"></div></div>' +
      '<div class="eq-vu-center"><div class="eq-vu-title">▷ 동영상 업로드 진행중</div>' +
      '<div class="eq-vu-name">' + esc(v.name || "") + "</div></div>";
    return node;
  }
  static value(node) {
    return { id: node.dataset.uid, name: node.querySelector(".eq-vu-name")?.textContent || "" };
  }
}
VideoUploadingBlot.blotName = "videouploading";
VideoUploadingBlot.tagName = "div";
Quill.register(VideoUploadingBlot);

const fmtSize = (bytes) => `${(bytes / 1048576).toFixed(2)}MB`;

// 링크 → 임베드(iframe) URL 변환: YouTube / Vimeo / 그 외 직접 URL
const toEmbedUrl = (raw) => {
  const url = String(raw || "").trim();
  if (!url) return "";
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return url;
};

// ── 표(테이블) 편집 유틸 ──
// 현재 선택 위치가 속한 <table> DOM 요소 반환(없으면 null)
const findTableEl = (quill) => {
  const sel = quill.getSelection();
  if (!sel) return null;
  const [leaf] = quill.getLeaf(sel.index);
  const node = leaf?.domNode;
  const elx = node ? (node.nodeType === 3 ? node.parentElement : node) : null;
  return (elx && elx.closest) ? elx.closest("table") : null;
};
// 특정 열(colIdx)의 모든 행 셀에 px 폭 지정
const setColWidth = (tableEl, colIdx, w) => {
  tableEl.querySelectorAll("tr").forEach((tr) => {
    const cell = tr.children[colIdx];
    if (cell) cell.style.width = `${Math.round(w)}px`;
  });
};
// 현재 렌더 폭을 명시적 px로 고정(리사이즈 기준 확보)
const normalizeTable = (tableEl) => {
  const firstRow = tableEl.querySelector("tr");
  if (!firstRow) return;
  const ws = Array.from(firstRow.children).map((c) => Math.round(c.getBoundingClientRect().width));
  ws.forEach((w, i) => setColWidth(tableEl, i, w));
  tableEl.style.width = `${ws.reduce((a, b) => a + b, 0)}px`;
};

const FORMATS = ["font", "size", "bold", "italic", "underline", "strike", "color", "background", "align", "list", "blockquote", "link", "image", "video", "videofile", "videouploading", "filecard", "hr", "table", "table-row", "table-body", "table-container"];

let TOOLBAR_SEQ = 0;

// value: HTML, onChange: (html)=>void, onImageUpload/onFileUpload: async(File)=>url
export default function RichEditor({ value, onChange, onImageUpload, onFileUpload, onVideoUpload }) {
  const quillRef = useRef(null);
  const toolbarId = useRef(`eqrich-tb-${(TOOLBAR_SEQ += 1)}`).current;
  const toolbarRef = useRef(null);

  // 툴바 팝오버: null | 'video' | 'table'
  const [menu, setMenu] = useState(null);
  const [videoMode, setVideoMode] = useState("choose"); // 'choose' | 'link'
  const [videoLink, setVideoLink] = useState("");
  const [tblHover, setTblHover] = useState({ r: 0, c: 0 });

  const closeMenu = useCallback(() => { setMenu(null); setVideoMode("choose"); setVideoLink(""); setTblHover({ r: 0, c: 0 }); }, []);

  // 팝오버 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => { if (toolbarRef.current && !toolbarRef.current.contains(e.target)) closeMenu(); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu, closeMenu]);

  // 서체/크기 풀다운: 다른 곳 아무 곳이나 클릭하면 닫히도록(클릭한 피커 자신은 Quill이 토글)
  useEffect(() => {
    const onDown = (e) => {
      const toolbar = document.getElementById(toolbarId);
      if (!toolbar) return;
      const open = toolbar.querySelectorAll(".ql-picker.ql-expanded");
      if (!open.length) return;
      const clicked = e.target.closest ? e.target.closest(".ql-picker") : null;
      open.forEach((p) => { if (p !== clicked) p.classList.remove("ql-expanded"); });
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [toolbarId]);

  const getEditor = () => quillRef.current?.getEditor?.();

  // ── 표 편집 오버레이 상태 ──
  const wrapRef = useRef(null);
  const activeTableRef = useRef(null);
  const [tblUI, setTblUI] = useState(null); // { top,left,width,height,cols:number[] }

  const measureTable = useCallback((el) => {
    const wrap = wrapRef.current;
    if (!wrap || !el || !document.contains(el)) { setTblUI(null); return; }
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const firstRow = el.querySelector("tr");
    const cells = firstRow ? Array.from(firstRow.children) : [];
    const cols = cells.map((c) => c.getBoundingClientRect().width);
    setTblUI({ top: r.top - wr.top, left: r.left - wr.left, width: r.width, height: r.height, cols });
  }, []);

  // 선택 위치가 표 안이면 오버레이 표시, 아니면 숨김 + 편집/리사이즈에 따라 재측정
  useEffect(() => {
    const quill = getEditor();
    if (!quill) return;
    const sync = () => {
      const el = findTableEl(quill);
      activeTableRef.current = el;
      if (el) measureTable(el); else setTblUI(null);
    };
    const remeasure = () => {
      const el = activeTableRef.current;
      if (el && document.contains(el)) measureTable(el);
      else if (el) { activeTableRef.current = null; setTblUI(null); }
    };
    quill.on("selection-change", sync);
    quill.on("text-change", remeasure);
    window.addEventListener("resize", remeasure);
    return () => {
      quill.off("selection-change", sync);
      quill.off("text-change", remeasure);
      window.removeEventListener("resize", remeasure);
    };
  }, [measureTable]);

  // 선택을 활성 표 내부로 보장(오버레이 버튼 클릭 시 caret 이 표 밖일 때 대비)
  const ensureCaretInTable = useCallback((quill, el) => {
    const cur = findTableEl(quill);
    if (cur === el) return;
    const firstCell = el.querySelector("td");
    const blot = firstCell && Quill.find(firstCell);
    if (blot) quill.setSelection(quill.getIndex(blot), 0, "silent");
  }, []);

  // 변경된 표 HTML을 부모 body에 반영(리사이즈/정렬은 text-change를 발생시키지 않으므로 수동 반영)
  // ReactQuill 내부 value 도 함께 동기화해야 값 재주입 시 clipboard 재파싱으로 표 폭이 유실되지 않음
  const pushHtml = useCallback(() => {
    const quill = getEditor();
    if (!quill) return;
    const html = quill.root.innerHTML;
    if (quillRef.current) quillRef.current.value = html;
    onChange?.(html);
  }, [onChange]);

  // 행/열 추가·삭제·표 삭제
  const tblAct = useCallback((action) => {
    const quill = getEditor();
    const el = activeTableRef.current;
    const tm = quill?.getModule?.("table");
    if (!quill || !el || !tm) return;
    ensureCaretInTable(quill, el);
    if (action === "rowAbove") tm.insertRowAbove();
    else if (action === "rowBelow") tm.insertRowBelow();
    else if (action === "rowDel") tm.deleteRow();
    else if (action === "colLeft") tm.insertColumnLeft();
    else if (action === "colRight") tm.insertColumnRight();
    else if (action === "colDel") tm.deleteColumn();
    else if (action === "delTable") { tm.deleteTable(); activeTableRef.current = null; setTblUI(null); return; }
    requestAnimationFrame(() => {
      const t = activeTableRef.current;
      if (t && document.contains(t)) measureTable(t); else setTblUI(null);
    });
  }, [ensureCaretInTable, measureTable]);

  // 모서리 점 드래그 → 가로(열 폭)·세로(행 높이) 모두 같은 비율로 축소/확대
  const startCornerResize = useCallback((e, corner) => {
    e.preventDefault(); e.stopPropagation();
    const el = activeTableRef.current; if (!el) return;
    normalizeTable(el);
    const firstRow = el.querySelector("tr");
    const origCols = firstRow ? Array.from(firstRow.children).map((c) => c.getBoundingClientRect().width) : [];
    const oldTotalW = origCols.reduce((a, b) => a + b, 0) || 1;
    const rows = Array.from(el.querySelectorAll("tr"));
    const origRows = rows.map((r) => r.getBoundingClientRect().height);
    const oldTotalH = origRows.reduce((a, b) => a + b, 0) || 1;
    rows.forEach((r, i) => { r.style.height = `${Math.round(origRows[i])}px`; }); // 세로 기준선 고정
    const minW = Math.max(origCols.length * 40, 80);
    const minH = Math.max(rows.length * 24, 24);
    const wrapW = wrapRef.current ? wrapRef.current.clientWidth : 2000;
    const startX = e.clientX, startY = e.clientY;
    const signRight = (corner === "br" || corner === "tr") ? 1 : -1;  // 오른쪽 모서리 +dx
    const signBottom = (corner === "br" || corner === "bl") ? 1 : -1; // 아래쪽 모서리 +dy
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) * signRight;
      const dy = (ev.clientY - startY) * signBottom;
      const newW = Math.min(wrapW - 8, Math.max(minW, oldTotalW + dx));
      const fx = newW / oldTotalW;
      origCols.forEach((w, i) => setColWidth(el, i, w * fx));
      el.style.width = `${Math.round(newW)}px`;
      const newH = Math.max(minH, oldTotalH + dy);
      const fy = newH / oldTotalH;
      rows.forEach((r, i) => { r.style.height = `${Math.round(origRows[i] * fy)}px`; });
      measureTable(el);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      pushHtml();
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [measureTable, pushHtml]);

  // 표 정렬 (왼쪽/가운데/오른쪽) — 표 폭이 100% 미만일 때 시각 반영
  const tblAlign = useCallback((align) => {
    const el = activeTableRef.current; if (!el) return;
    if (align === "left") { el.style.marginLeft = "0"; el.style.marginRight = "auto"; }
    else if (align === "center") { el.style.marginLeft = "auto"; el.style.marginRight = "auto"; }
    else { el.style.marginLeft = "auto"; el.style.marginRight = "0"; }
    measureTable(el);
    pushHtml();
  }, [measureTable, pushHtml]);

  // 사진: 여러 장 동시 선택 → 순서대로 업로드·삽입
  const imageHandler = useCallback(() => {
    closeMenu();
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*"; input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const ed = getEditor(); if (!ed) return;
      let index = ed.getSelection(true)?.index ?? ed.getLength();
      for (const file of files) {
        const url = await onImageUpload?.(file);
        if (!url) continue;
        ed.insertEmbed(index, "image", url, "user");
        index += 1;
      }
      ed.setSelection(index, 0, "user");
    };
    input.click();
  }, [onImageUpload, closeMenu]);

  // 파일: 첨부 → 파일명·용량 카드로 삽입
  const fileHandler = useCallback(() => {
    closeMenu();
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const url = await onFileUpload?.(file); if (!url) return;
      const ed = getEditor(); if (!ed) return;
      const index = ed.getSelection(true)?.index ?? ed.getLength();
      ed.insertEmbed(index, "filecard", { url, name: file.name, size: fmtSize(file.size) }, "user");
      ed.setSelection(index + 1, 0, "user");
    };
    input.click();
  }, [onFileUpload, closeMenu]);

  // 동영상 파일 첨부 → 업로드 진행바(오렌지) 표시 후 재생 가능한 <video>로 교체
  const pickVideoFile = useCallback(() => {
    closeMenu();
    const input = document.createElement("input");
    input.type = "file"; input.accept = "video/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const ed = getEditor(); if (!ed) return;
      const uid = `vu_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const index = ed.getSelection(true)?.index ?? ed.getLength();
      ed.insertEmbed(index, "videouploading", { id: uid, name: file.name }, "user");
      ed.setSelection(index + 1, 0, "user");
      const findNode = () => ed.root.querySelector(`.eq-video-uploading[data-uid="${uid}"]`);

      let url = null;
      try {
        url = await onVideoUpload?.(file, (pct) => {
          const fill = findNode()?.querySelector(".eq-vu-fill");
          if (fill) fill.style.width = `${pct}%`;
        });
      } catch { url = null; }

      // 플레이스홀더를 실제 영상(또는 실패 시 제거)로 교체
      const node = findNode();
      if (node) {
        const blot = Quill.find(node);
        const at = ed.getIndex(blot);
        ed.deleteText(at, 1, "user");
        if (url) { ed.insertEmbed(at, "videofile", url, "user"); ed.setSelection(at + 1, 0, "user"); }
      }
    };
    input.click();
  }, [onVideoUpload, closeMenu]);

  // 동영상 링크(YouTube/Vimeo 등) → 임베드 iframe 삽입
  const insertVideoLink = useCallback(() => {
    const src = toEmbedUrl(videoLink);
    if (!src) return;
    const ed = getEditor(); if (!ed) { closeMenu(); return; }
    ed.focus();
    const index = ed.getSelection(true)?.index ?? ed.getLength();
    ed.insertEmbed(index, "video", src, "user");
    ed.setSelection(index + 1, 0, "user");
    closeMenu();
  }, [videoLink, closeMenu]);

  // 표 삽입 (rows × cols)
  const insertTable = useCallback((rows, cols) => {
    const ed = getEditor(); if (!ed) { closeMenu(); return; }
    ed.focus();
    if (!ed.getSelection()) ed.setSelection(Math.max(ed.getLength() - 1, 0), 0, "silent");
    ed.getModule("table")?.insertTable(rows, cols);
    closeMenu();
  }, [closeMenu]);

  const hrHandler = useCallback(() => {
    closeMenu();
    const ed = getEditor(); if (!ed) return;
    const r = ed.getSelection(true);
    ed.insertEmbed(r.index, "hr", true, "user");
    ed.setSelection(r.index + 1, 0, "user");
  }, [closeMenu]);

  const undo = useCallback(() => getEditor()?.history.undo(), []);
  const redo = useCallback(() => getEditor()?.history.redo(), []);

  // 본문 이미지·영상·파일: 클릭 시 검은 테두리로 선택, Delete/Backspace로 삭제(중간 항목 포함)
  useEffect(() => {
    const quill = getEditor();
    if (!quill) return;
    const root = quill.root;
    const SELECTED = "eq-img-selected";
    const SELECTOR = "img, .eq-video-block, a.eq-file-card";
    const clear = () => root.querySelectorAll("." + SELECTED).forEach((el) => el.classList.remove(SELECTED));

    const onClick = (e) => {
      clear();
      const el = e.target.closest ? e.target.closest(SELECTOR) : null;
      if (el) {
        if (el.tagName === "A") e.preventDefault(); // 파일 링크 이동 방지 → 선택만
        el.classList.add(SELECTED);
        const blot = Quill.find(el);
        // 길이 0(캐럿만) → 파랑 텍스트 선택이 안 생김. 삭제는 keydown 핸들러가 처리
        if (blot) quill.setSelection(quill.getIndex(blot), 0, "user");
      }
    };
    const onKeyDown = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const sel = root.querySelector("." + SELECTED);
      if (!sel) return;
      const blot = Quill.find(sel);
      if (!blot) return;
      e.preventDefault();
      const index = quill.getIndex(blot);
      quill.deleteText(index, 1, "user");
      clear();
      quill.setSelection(index, 0, "user");
    };
    const onTextChange = () => clear(); // 내용 편집 시 선택 표시 해제

    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeyDown);
    quill.on("text-change", onTextChange);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      quill.off("text-change", onTextChange);
    };
  }, []);

  const modules = useMemo(() => ({
    toolbar: { container: `#${toolbarId}` },
    clipboard: { matchVisual: false },
    table: true,
  }), [toolbarId]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div id={toolbarId} className={styles.toolbar} ref={toolbarRef}>
        {/* 1행: 미디어 + 되돌리기 */}
        <div className={styles.rowMedia}>
          <span className={styles.mediaGroup}>
            <button type="button" className={styles.mediaBtn} onClick={imageHandler} aria-label="사진"><span className={styles.mIco}><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3.5" /><circle cx="8.5" cy="8.5" r="1.7" /><path d="m21 15-4.6-4.6L5 21.5" /></svg></span>사진</button>
            <span className={styles.anchor}>
              <button type="button" className={styles.mediaBtn} aria-haspopup="true" aria-expanded={menu === "video"} onClick={() => { setMenu((m) => (m === "video" ? null : "video")); setVideoMode("choose"); }}><span className={styles.mIco}><svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="13.5" height="12" rx="3" /><path d="M16 10.5l5-2.7v8.4l-5-2.7z" fill="currentColor" stroke="none" /></svg></span>동영상</button>
              {menu === "video" && videoMode === "choose" && (
                <div className={styles.popover} role="menu">
                  <button type="button" className={styles.popItem} onClick={pickVideoFile}><span className={styles.popIco}>🎬</span>동영상 파일 업로드</button>
                  <button type="button" className={styles.popItem} onClick={() => setVideoMode("link")}><span className={styles.popIco}>🔗</span>링크 넣기 (YouTube 등)</button>
                </div>
              )}
              {menu === "video" && videoMode === "link" && (
                <div className={styles.modalOverlay} onMouseDown={(e) => { if (e.target === e.currentTarget) closeMenu(); }}>
                  <div className={styles.modal} role="dialog" aria-modal="true">
                    <div className={styles.modalTitle}>동영상 링크 넣기</div>
                    <p className={styles.modalHint}>YouTube · Vimeo 주소 또는 동영상 임베드 링크를 붙여넣으세요.</p>
                    <input
                      className={styles.modalInput}
                      type="url"
                      autoFocus
                      value={videoLink}
                      onChange={(e) => setVideoLink(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertVideoLink(); } else if (e.key === "Escape") { closeMenu(); } }}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <div className={styles.modalActions}>
                      <button type="button" className={styles.popPrimary} onClick={insertVideoLink} disabled={!videoLink.trim()}>확인</button>
                      <button type="button" className={styles.popGhost} onClick={closeMenu}>취소</button>
                    </div>
                  </div>
                </div>
              )}
            </span>
            <button type="button" className={styles.mediaBtn} onClick={fileHandler}><span className={styles.mIco}><svg viewBox="0 0 24 24"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3H14l5 5v11.5A1.5 1.5 0 0 1 17.5 21z" /><path d="M9 13h6M9 16.5h4" /></svg></span>파일</button>
          </span>
          <span className={styles.histGroup}>
            <button type="button" className={styles.iconBtn} onClick={undo} aria-label="되돌리기" data-tip="되돌리기">↺</button>
            <button type="button" className={styles.iconBtn} onClick={redo} aria-label="다시실행" data-tip="다시 실행">↻</button>
          </span>
        </div>
        {/* 2행: 서식 */}
        <div className={styles.rowFormat}>
          <select className="ql-font" defaultValue="">
            {FONTS.map((f) => (<option key={f || "default"} value={f}></option>))}
          </select>
          <select className="ql-size" defaultValue="16px">
            {SIZES.map((s) => (<option key={s} value={s}></option>))}
          </select>
          <span className={styles.sep} />
          <button type="button" className="ql-bold" data-tip="굵게" />
          <button type="button" className="ql-italic" data-tip="기울임" />
          <button type="button" className="ql-underline" data-tip="밑줄" />
          <button type="button" className="ql-strike" data-tip="취소선" />
          <span className={styles.anchor} data-tip="글자색"><select className="ql-color" /></span>
          <span className={styles.anchor} data-tip="배경색"><select className="ql-background" /></span>
          <span className={styles.sep} />
          <button type="button" className="ql-align" value="" data-tip="왼쪽 정렬" />
          <button type="button" className="ql-align" value="center" data-tip="가운데 정렬" />
          <button type="button" className="ql-align" value="right" data-tip="오른쪽 정렬" />
          <button type="button" className="ql-align" value="justify" data-tip="양쪽 정렬" />
          <span className={styles.sep} />
          <button type="button" className="ql-list" value="bullet" data-tip="글머리 기호" />
          <button type="button" className="ql-list" value="ordered" data-tip="번호 목록" />
          <button type="button" className="ql-blockquote" data-tip="인용구" />
          <button type="button" className="ql-link" data-tip="링크" />
          <button type="button" className={styles.iconBtn} onClick={hrHandler} aria-label="구분선" data-tip="구분선">—</button>
          <span className={styles.anchor}>
            <button type="button" className={styles.iconBtn} aria-label="표" data-tip="표" aria-haspopup="true" aria-expanded={menu === "table"} onClick={() => { setMenu((m) => (m === "table" ? null : "table")); setTblHover({ r: 0, c: 0 }); }}>
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <rect className="ql-stroke" x="2.5" y="2.5" width="13" height="13" rx="1.5" fill="none" />
                <line className="ql-stroke" x1="9" y1="2.5" x2="9" y2="15.5" />
                <line className="ql-stroke" x1="2.5" y1="9" x2="15.5" y2="9" />
              </svg>
            </button>
            {menu === "table" && (
              <div className={`${styles.popover} ${styles.tablePop}`} role="menu">
                <div className={styles.tblGrid} onMouseLeave={() => setTblHover({ r: 0, c: 0 })}>
                  {Array.from({ length: 8 }).map((_, r) => (
                    Array.from({ length: 8 }).map((_, c) => (
                      <span
                        key={`${r}-${c}`}
                        className={`${styles.tblCell} ${r < tblHover.r && c < tblHover.c ? styles.tblOn : ""}`}
                        onMouseEnter={() => setTblHover({ r: r + 1, c: c + 1 })}
                        onClick={() => insertTable(r + 1, c + 1)}
                      />
                    ))
                  ))}
                </div>
                <div className={styles.tblLabel}>{tblHover.r > 0 ? `${tblHover.r} × ${tblHover.c}` : "표 크기 선택"}</div>
              </div>
            )}
          </span>
        </div>
      </div>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value || ""}
        onChange={onChange}
        useSemanticHTML={false}
        modules={modules}
        formats={FORMATS}
        placeholder="내용을 입력하세요. 사진·동영상·파일과 글을 자유롭게 배치할 수 있습니다."
      />

      {/* 표 편집 오버레이 (표 클릭 시 표시) */}
      {tblUI && (
        <div className={styles.tblOverlay} style={{ top: tblUI.top, left: tblUI.left, width: tblUI.width, height: tblUI.height }}>
          <div className={styles.tblToolbar} onMouseDown={(e) => e.preventDefault()}>
            {/* 행 */}
            <button type="button" onClick={() => tblAct("rowAbove")} data-tip="위에 행 삽입" aria-label="위에 행 삽입">
              <svg viewBox="0 0 24 24"><path d="M12 3.5v7" /><path d="m8.5 7 3.5-3.5 3.5 3.5" /><rect x="4" y="14.5" width="16" height="5.5" rx="1.4" /></svg>
            </button>
            <button type="button" onClick={() => tblAct("rowBelow")} data-tip="아래에 행 삽입" aria-label="아래에 행 삽입">
              <svg viewBox="0 0 24 24"><path d="M12 20.5v-7" /><path d="m8.5 17 3.5 3.5 3.5-3.5" /><rect x="4" y="4" width="16" height="5.5" rx="1.4" /></svg>
            </button>
            <button type="button" onClick={() => tblAct("rowDel")} data-tip="행 삭제" aria-label="행 삭제">
              <svg viewBox="0 0 24 24"><rect x="4" y="9.25" width="16" height="5.5" rx="1.4" /><path d="M10.2 10.6l3.6 2.8M13.8 10.6l-3.6 2.8" /></svg>
            </button>
            <span className={styles.tblToolSep} />
            {/* 열 */}
            <button type="button" onClick={() => tblAct("colLeft")} data-tip="왼쪽에 열 삽입" aria-label="왼쪽에 열 삽입">
              <svg viewBox="0 0 24 24"><path d="M3.5 12h7" /><path d="m7 8.5-3.5 3.5 3.5 3.5" /><rect x="14.5" y="4" width="5.5" height="16" rx="1.4" /></svg>
            </button>
            <button type="button" onClick={() => tblAct("colRight")} data-tip="오른쪽에 열 삽입" aria-label="오른쪽에 열 삽입">
              <svg viewBox="0 0 24 24"><path d="M20.5 12h-7" /><path d="m17 8.5 3.5 3.5-3.5 3.5" /><rect x="4" y="4" width="5.5" height="16" rx="1.4" /></svg>
            </button>
            <button type="button" onClick={() => tblAct("colDel")} data-tip="열 삭제" aria-label="열 삭제">
              <svg viewBox="0 0 24 24"><rect x="9.25" y="4" width="5.5" height="16" rx="1.4" /><path d="M10.6 10.2l2.8 3.6M13.4 10.2l-2.8 3.6" /></svg>
            </button>
            <span className={styles.tblToolSep} />
            {/* 정렬 */}
            <button type="button" onClick={() => tblAlign("left")} data-tip="왼쪽 정렬" aria-label="왼쪽 정렬">
              <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" /><rect className={styles.tblFill} x="5.2" y="7" width="8" height="10" rx="1" /></svg>
            </button>
            <button type="button" onClick={() => tblAlign("center")} data-tip="가운데 정렬" aria-label="가운데 정렬">
              <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" /><rect className={styles.tblFill} x="8" y="7" width="8" height="10" rx="1" /></svg>
            </button>
            <button type="button" onClick={() => tblAlign("right")} data-tip="오른쪽 정렬" aria-label="오른쪽 정렬">
              <svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2" /><rect className={styles.tblFill} x="10.8" y="7" width="8" height="10" rx="1" /></svg>
            </button>
            <span className={styles.tblToolSep} />
            {/* 표 삭제 */}
            <button type="button" className={styles.tblDelBtn} onClick={() => tblAct("delTable")} data-tip="표 삭제" aria-label="표 삭제">
              <svg viewBox="0 0 24 24"><path d="M4 6.5h16" /><path d="M9 6.5V5a1.3 1.3 0 0 1 1.3-1.3h3.4A1.3 1.3 0 0 1 15 5v1.5" /><path d="M17.8 6.5l-.85 12.3a2 2 0 0 1-2 1.85H9.05a2 2 0 0 1-2-1.85L6.2 6.5" /><path d="M10.2 10.5v6M13.8 10.5v6" /></svg>
            </button>
          </div>
          <span className={`${styles.tblCorner} ${styles.tblCornerTL}`} onMouseDown={(e) => startCornerResize(e, "tl")} />
          <span className={`${styles.tblCorner} ${styles.tblCornerTR}`} onMouseDown={(e) => startCornerResize(e, "tr")} />
          <span className={`${styles.tblCorner} ${styles.tblCornerBL}`} onMouseDown={(e) => startCornerResize(e, "bl")} />
          <span className={`${styles.tblCorner} ${styles.tblCornerBR}`} onMouseDown={(e) => startCornerResize(e, "br")} />
        </div>
      )}
    </div>
  );
}
```

### `RichEditor.module.css`

```css
.wrap{position:relative;border:1px solid var(--color-border);border-radius:10px;overflow:hidden;background:#fff}

/* Quill 기본 테두리 제거 */
.wrap :global(.ql-toolbar.ql-snow){border:none;padding:0;font-family:inherit}
.wrap :global(.ql-container.ql-snow){border:none;font-family:inherit;font-size:16px}
.wrap :global(.ql-editor){min-height:400px;padding:20px 22px;line-height:1.8;color:var(--color-text)}
.wrap :global(.ql-editor.ql-blank::before){color:#aeb4bd;font-style:normal;left:22px;right:22px}
.wrap :global(.ql-editor img){max-width:100%;height:auto;border-radius:8px;cursor:pointer}
/* 편집기 내 동영상: 재생 대신 클릭 선택 (80% 폭, 가운데) */
.wrap :global(.ql-editor .eq-video-block){cursor:pointer;margin:8px 0;text-align:center}
.wrap :global(.ql-editor .eq-video-block video){width:80%;max-width:80%;border-radius:10px;background:#000;pointer-events:none;display:inline-block;vertical-align:top}
/* 링크 동영상(iframe)도 파일 동영상과 동일 크기(80% 폭, 가운데, 16:9) */
.wrap :global(.ql-editor iframe.ql-video){display:block;width:80%;max-width:80%;aspect-ratio:16/9;height:auto;margin:8px auto;border:0;border-radius:10px;background:#000}
/* 선택된 항목(이미지·영상·파일): 검은 테두리 */
.wrap :global(.ql-editor img.eq-img-selected),
.wrap :global(.ql-editor a.eq-file-card.eq-img-selected),
.wrap :global(.ql-editor .eq-video-block.eq-img-selected){outline:3px solid #111;outline-offset:1px;border-radius:10px}
/* 동영상 업로드 진행 플레이스홀더 */
.wrap :global(.eq-video-uploading){position:relative;background:#eef0f2;border-radius:10px;min-height:230px;margin:8px 0;overflow:hidden;display:flex;align-items:center;justify-content:center;user-select:none}
.wrap :global(.eq-video-uploading .eq-vu-bar){position:absolute;top:0;left:0;right:0;height:4px;background:#e2e5e9}
.wrap :global(.eq-video-uploading .eq-vu-fill){height:100%;width:0;background:#ff6a00;transition:width .2s ease}
.wrap :global(.eq-video-uploading .eq-vu-center){text-align:center}
.wrap :global(.eq-video-uploading .eq-vu-title){font-size:18px;font-weight:600;color:#5b6472;margin-bottom:8px}
.wrap :global(.eq-video-uploading .eq-vu-name){font-size:14px;color:#9aa1ac}
/* 첨부 파일 카드 */
.wrap :global(.ql-editor a.eq-file-card){
  display:flex;align-items:center;gap:14px;max-width:520px;
  padding:16px 18px;margin:8px 0;border:1px solid var(--color-border);border-radius:10px;
  text-decoration:none;color:var(--color-primary);background:#fff;cursor:pointer;
}
.wrap :global(.ql-editor a.eq-file-card:hover){border-color:var(--color-primary)}
.wrap :global(.eq-file-ico){font-size:26px;line-height:1;flex:none}
.wrap :global(.eq-file-meta){display:flex;flex-direction:column;gap:4px;min-width:0}
.wrap :global(.eq-file-name){font-weight:600;color:var(--color-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wrap :global(.eq-file-size){font-size:13px;color:var(--color-muted)}

/* ── 1행: 미디어 + 되돌리기 ── */
.rowMedia{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--color-border)}
.mediaGroup{display:flex;gap:4px}
/* Quill 기본 button{width:28px}를 이기기 위해 !important */
.mediaBtn{
  display:inline-flex!important;align-items:center;gap:7px;
  width:auto!important;height:34px!important;min-width:0!important;
  padding:0 12px!important;white-space:nowrap;
  border:none;background:none;color:#5b6472;font-size:14px;font-weight:500;font-family:inherit;cursor:pointer;border-radius:6px;float:none!important;
}
.mediaBtn:hover{background:#f1f3f5;color:var(--color-primary)}
.mIco{display:inline-flex;align-items:center;font-size:15px;line-height:1}
.mIco svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.histGroup{display:flex;gap:2px}
.iconBtn{
  width:34px!important;height:34px!important;padding:0!important;
  display:inline-flex!important;align-items:center;justify-content:center;
  border:none;background:none;color:#9aa1ac;font-size:18px;cursor:pointer;border-radius:6px;float:none!important;
}
.iconBtn:hover{background:#f1f3f5;color:var(--color-primary)}

/* ── 2행: 서식 (Quill 기본 버튼 크기는 유지) ── */
.rowFormat{display:flex;flex-wrap:wrap;align-items:center;gap:0;padding:6px 12px;background:#f7f8fa}
.sep{display:inline-block;width:1px;height:20px;background:#dfe3e8;margin:0 8px}
/* 서식 버튼·아이콘 크기 고정 (Quill 기본 SVG 왜곡 방지) */
.rowFormat :global(button){width:28px!important;height:26px!important;padding:3px 5px!important;float:none!important;display:inline-flex!important;align-items:center;justify-content:center}
.rowFormat :global(button svg){width:100%!important;height:100%!important;float:none!important}
.rowFormat :global(.ql-stroke){stroke:#4b5563}
.rowFormat :global(.ql-fill){fill:#4b5563}
.rowFormat :global(button:hover){background:#eceff2;border-radius:5px}
.rowFormat :global(button:hover .ql-stroke),
.rowFormat :global(.ql-picker-label:hover .ql-stroke){stroke:var(--color-primary)}
.rowFormat :global(button.ql-active){background:#e7ecf5;border-radius:5px}
.rowFormat :global(button.ql-active .ql-stroke){stroke:var(--color-primary)}
.rowFormat :global(button.ql-active .ql-fill){fill:var(--color-primary)}

/* 서체 피커(기본서체 라벨 + 아래 화살표) */
.rowFormat :global(.ql-font){width:92px}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label){color:#4b5563;font-weight:500;position:relative;padding-right:20px}
/* Quill 기본 caret 숨기고 오른쪽에 아래 화살표(chevron) 추가 */
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label) svg{display:none}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label)::after{content:"";position:absolute;right:8px;top:50%;width:7px;height:7px;border-right:1.6px solid #4b5563;border-bottom:1.6px solid #4b5563;transform:translateY(-70%) rotate(45deg);pointer-events:none}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label)::before{content:"기본서체"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Malgun Gothic"])::before{content:"맑은 고딕"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Dotum"])::before{content:"돋움"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Gulim"])::before{content:"굴림"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-label[data-value="Batang"])::before{content:"바탕"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item)::before{content:attr(data-value)!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value=""])::before{content:"기본서체"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Malgun Gothic"])::before{content:"맑은 고딕"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Dotum"])::before{content:"돋움"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Gulim"])::before{content:"굴림"!important}
.wrap :global(.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Batang"])::before{content:"바탕"!important}

/* 크기 피커(px 표시 + 아래 화살표) */
.rowFormat :global(.ql-size){width:66px}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-label){position:relative;padding-right:18px}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-label) svg{display:none}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-label)::after{content:"";position:absolute;right:7px;top:50%;width:7px;height:7px;border-right:1.6px solid #4b5563;border-bottom:1.6px solid #4b5563;transform:translateY(-70%) rotate(45deg);pointer-events:none}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-label)::before{content:"16px"!important}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-label[data-value])::before{content:attr(data-value)!important}
.wrap :global(.ql-snow .ql-picker.ql-size .ql-picker-item)::before{content:attr(data-value)!important}

.rowFormat :global(.ql-picker){height:30px;font-size:14px;color:#4b5563}
.rowFormat :global(.ql-picker-label){display:inline-flex;align-items:center;padding-left:8px;border:1px solid transparent;border-radius:5px}
.rowFormat :global(.ql-picker-label:hover),
.rowFormat :global(.ql-picker.ql-expanded .ql-picker-label){border-color:#dfe3e8;background:#fff}
.rowFormat :global(.ql-picker-options){border-color:#dfe3e8;border-radius:8px;box-shadow:0 6px 20px rgba(16,35,63,.12);padding:6px 4px}

/* ── 아이콘 호버 툴팁 (조그만 말풍선) ── */
.rowMedia [data-tip],.rowFormat [data-tip]{position:relative}
.rowMedia [data-tip]:hover::after,.rowFormat [data-tip]:hover::after{
  content:attr(data-tip);position:absolute;top:calc(100% + 7px);left:50%;transform:translateX(-50%);
  padding:5px 9px;background:#2b2f36;color:#fff;font-size:11px;font-weight:500;line-height:1;letter-spacing:.01em;
  border-radius:6px;white-space:nowrap;pointer-events:none;z-index:60;box-shadow:0 4px 12px rgba(0,0,0,.2)
}
.rowMedia [data-tip]:hover::before,.rowFormat [data-tip]:hover::before{
  content:"";position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);
  border:5px solid transparent;border-bottom-color:#2b2f36;pointer-events:none;z-index:60
}

/* ── 툴바 팝오버(동영상 선택 / 표 크기) ── */
.anchor{position:relative;display:inline-flex}
.popover{
  position:absolute;top:calc(100% + 8px);left:0;z-index:70;min-width:220px;
  background:#fff;border:1px solid var(--color-border);border-radius:10px;
  box-shadow:0 10px 30px rgba(16,35,63,.16);padding:6px;
}
.popItem{
  display:flex!important;align-items:center;gap:10px;width:100%!important;height:auto!important;min-width:0!important;
  padding:10px 12px!important;border:none;background:none;border-radius:7px;
  font-size:14px;font-weight:500;color:#3a4250;font-family:inherit;text-align:left;cursor:pointer;white-space:nowrap;float:none!important;
}
.popItem:hover{background:#f1f3f5;color:var(--color-primary)}
.popIco{font-size:16px;line-height:1}
.popLink{display:flex;flex-direction:column;gap:8px;padding:8px}
.popLabel{font-size:12px;font-weight:600;color:#6b7482}
.popInput{
  width:260px;max-width:64vw;height:38px;padding:0 12px;font-size:14px;font-family:inherit;color:var(--color-text);
  border:1px solid var(--color-border);border-radius:8px;background:#fff;outline:none;
}
.popInput:focus{border-color:var(--color-primary)}
.popActions{display:flex;justify-content:flex-end;gap:8px}
.popGhost,.popPrimary{width:auto!important;height:34px!important;padding:0 16px!important;float:none!important;display:inline-flex!important;align-items:center;justify-content:center;font-size:13px;font-weight:600;font-family:inherit;border-radius:7px;cursor:pointer;border:1px solid transparent}
.popGhost{background:#fff!important;color:#6b7482!important;border:1px solid var(--color-border)!important}
.popGhost:hover{color:var(--color-primary)!important;border-color:var(--color-primary)!important}
.popPrimary{background:var(--color-primary)!important;color:#fff!important;border:none!important}
.popPrimary:hover{filter:brightness(1.15)}
.popPrimary:disabled{opacity:.5;cursor:default;filter:none}

/* 동영상 링크 모달 (화면 중앙, overflow 클리핑 회피) */
.modalOverlay{position:fixed;inset:0;z-index:1000;background:rgba(16,35,63,.4);display:flex;align-items:center;justify-content:center;padding:20px}
.modal{width:440px;max-width:92vw;background:#fff;border-radius:14px;box-shadow:0 24px 64px rgba(16,35,63,.3);padding:24px 24px 20px;box-sizing:border-box}
.modalTitle{font-size:17px;font-weight:700;color:var(--color-primary);margin-bottom:6px}
.modalHint{font-size:13px;color:#6b7482;line-height:1.5;margin-bottom:16px}
.modalInput{
  width:100%;height:44px;padding:0 14px;font-size:15px;font-family:inherit;color:var(--color-text);box-sizing:border-box;
  border:1px solid var(--color-border);border-radius:9px;background:#fff;outline:none;
}
.modalInput:focus{border-color:var(--color-primary)}
.modalActions{display:flex;justify-content:center;gap:12px;margin-top:22px}
.modalActions .popGhost,.modalActions .popPrimary{min-width:88px;height:24px!important;font-size:13px}

/* 표 크기 그리드 피커 */
.tablePop{left:auto;right:0;min-width:0;padding:10px}
.tblGrid{display:grid;grid-template-columns:repeat(8,20px);grid-auto-rows:20px;gap:3px}
.tblCell{width:20px;height:20px;border:1px solid #d4d9df;border-radius:3px;background:#fff;cursor:pointer;box-sizing:border-box}
.tblOn{border-color:var(--color-primary);background:var(--color-accent-soft,#e7ecf5)}
.tblLabel{margin-top:8px;text-align:center;font-size:12px;font-weight:600;color:#6b7482}

/* ── 편집기 내 표 렌더 ── */
.wrap :global(.ql-editor table){border-collapse:collapse;width:100%;max-width:100%;margin:10px 0;table-layout:fixed}
.wrap :global(.ql-editor td){border:1px solid #c9cfd6;padding:8px 10px;vertical-align:top;min-width:36px;position:relative}

/* ── 표 편집 오버레이 (선택·정렬·삭제·비율 리사이즈) ── */
.tblOverlay{position:absolute;z-index:45;pointer-events:none;box-sizing:border-box}
/* 아이콘 툴바 (흰 배경 · 표 위 가운데) */
.tblToolbar{position:absolute;top:-36px;left:50%;transform:translateX(-50%);width:max-content;max-width:none;display:flex;align-items:center;gap:1px;padding:2px 3px;background:#fff;border:1px solid #e2e5e9;border-radius:8px;box-shadow:0 6px 22px rgba(16,35,63,.18);pointer-events:auto;white-space:nowrap}
.tblToolbar button{flex:none;width:30px!important;height:22px!important;min-width:0!important;padding:0!important;float:none!important;display:inline-flex!important;align-items:center;justify-content:center;border:none;background:none;color:#4b5563;border-radius:5px;cursor:pointer}
.tblToolbar button:hover{background:#eef1f4;color:var(--color-primary)}
.tblToolbar svg{width:18px;height:18px;stroke:currentColor;stroke-width:1.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
.tblFill{fill:currentColor;stroke:none}
.tblToolSep{width:1px;height:16px;background:#e2e5e9;margin:0 3px;flex:none}
.tblDelBtn:hover{background:#fdeceb!important;color:#e5484d!important}
/* 아이콘 호버 설명(툴바 아래로) */
.tblToolbar [data-tip]{position:relative}
.tblToolbar [data-tip]:hover::after{content:attr(data-tip);position:absolute;top:calc(100% + 9px);left:50%;transform:translateX(-50%);padding:5px 9px;background:#2b2f36;color:#fff;font-size:11px;font-weight:500;line-height:1;white-space:nowrap;border-radius:6px;pointer-events:none;z-index:80;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.tblToolbar [data-tip]:hover::before{content:"";position:absolute;top:calc(100% + 4px);left:50%;transform:translateX(-50%);border:5px solid transparent;border-bottom-color:#2b2f36;pointer-events:none;z-index:80}
/* 모서리 점(비율 리사이즈 핸들) */
.tblCorner{position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid var(--color-primary);box-sizing:border-box;pointer-events:auto;box-shadow:0 1px 3px rgba(16,35,63,.3)}
.tblCornerTL{top:-6px;left:-6px;cursor:nwse-resize}
.tblCornerTR{top:-6px;right:-6px;cursor:nesw-resize}
.tblCornerBL{bottom:-6px;left:-6px;cursor:nesw-resize}
.tblCornerBR{bottom:-6px;right:-6px;cursor:nwse-resize}
```

---

## 6. 저장된 내용 렌더링 (상세/뷰 페이지)

에디터가 만든 HTML(`value`/`onChange`)을 그대로 DB에 저장한 뒤, 뷰 페이지에서는 **DOMPurify로 sanitize 후** 렌더합니다. iframe·video·다운로드 링크 관련 태그/속성을 허용해야 동영상·파일 카드가 보입니다.

```jsx
import DOMPurify from "dompurify";

function ArticleBody({ html }) {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe", "video"],
    ADD_ATTR: ["target", "allow", "allowfullscreen", "frameborder", "scrolling",
               "controls", "controlslist", "preload", "download", "rel"],
  });
  return <div className="rich-body" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

뷰 페이지용 CSS (에디터와 동일한 모양으로 렌더):

```css
.rich-body{font-size:17px;line-height:1.9;color:var(--color-text)}
.rich-body img{max-width:100%;height:auto;border-radius:10px;display:block;margin:12px 0}
.rich-body p{margin:0 0 12px}
.rich-body a{color:var(--color-primary);text-decoration:underline}
.rich-body ul,.rich-body ol{margin:0 0 12px;padding-left:22px}
.rich-body blockquote{border-left:3px solid var(--color-primary);margin:0 0 12px;padding:4px 0 4px 16px;color:var(--color-muted)}
.rich-body hr{border:none;border-top:1px solid var(--color-border);margin:22px 0}
/* 동영상 (파일/링크 동일 80% 폭, 가운데) */
.rich-body iframe{display:block;width:80%;max-width:80%;aspect-ratio:16/9;border:0;border-radius:10px;margin:12px auto;background:#000}
.rich-body .eq-video-block{text-align:center;margin:12px 0}
.rich-body .eq-video-block video,.rich-body video{width:80%;max-width:80%;border-radius:10px;background:#000;display:inline-block}
/* 첨부 파일 카드 */
.rich-body a.eq-file-card{display:flex;align-items:center;gap:14px;max-width:520px;padding:16px 18px;margin:12px 0;border:1px solid var(--color-border);border-radius:10px;text-decoration:none;background:#fff}
.rich-body a.eq-file-card:hover{border-color:var(--color-primary)}
.rich-body .eq-file-ico{font-size:26px;line-height:1;flex:none}
.rich-body .eq-file-meta{display:flex;flex-direction:column;gap:4px;min-width:0}
.rich-body .eq-file-name{font-weight:600;color:var(--color-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rich-body .eq-file-size{font-size:13px;color:var(--color-muted)}
/* 표 */
.rich-body table{border-collapse:collapse;width:100%;max-width:100%;margin:16px 0;table-layout:fixed}
.rich-body td,.rich-body th{border:1px solid var(--color-border);padding:10px 12px;vertical-align:top;word-break:break-word}
.rich-body th{background:#f7f8fa;font-weight:700}
```

---

## 7. 업로드 핸들러 구현 예시

핸들러는 "파일 → 공개 URL"만 지키면 어떤 백엔드든 됩니다. 아래는 참고 구현입니다.

### 단순 fetch 업로드

```js
const onImageUpload = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const { url } = await res.json();
  return url; // 공개 접근 가능한 절대/상대 URL
};
```

### 진행률 있는 동영상 업로드 (XHR)

```js
const onVideoUpload = (file, onProgress) => new Promise((resolve) => {
  const fd = new FormData();
  fd.append("file", file);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
  };
  xhr.onload = () => {
    try {
      if (xhr.status < 200 || xhr.status >= 300) return resolve(null);
      const { url } = JSON.parse(xhr.responseText);
      resolve(url || null);
    } catch { resolve(null); }
  };
  xhr.onerror = () => resolve(null);
  xhr.send(fd);
});
```

> ⚠️ 동영상 업로드 성공 판정은 **HTTP 2xx + 실제 URL 존재**로 하세요. 응답 래퍼의 `statusCode` 필드에만 의존하면, 서버가 그 필드를 안 주는 경우 업로드가 성공했는데도 영상이 사라지는 버그가 납니다.

---

## 8. 알아둘 점 / 한계

- **인라인 스타일 포맷**: size/font/color/background/align 을 class 가 아닌 inline style 로 저장하므로 뷰 페이지에서 별도 Quill CSS 없이도 서식이 유지됩니다.
- **표 폭/정렬 저장**: 리사이즈·정렬 결과는 셀 inline style 로 저장되어 **뷰 페이지에는 그대로 반영**됩니다. 다만 Quill 네이티브 표 모델은 셀 폭을 델타에 저장하지 않으므로, **이미 저장된 글을 에디터에서 다시 열면** 조절값이 초기화될 수 있습니다(재편집 시). 편집 재진입까지 완전 보존하려면 width 를 저장하는 커스텀 셀 blot 이 필요합니다.
- **표 병합/머리글**: Quill 2 네이티브 표 모듈은 셀 병합·머리글 토글을 지원하지 않아 툴바에서 제외했습니다.
- **보안**: 뷰 렌더는 반드시 DOMPurify(또는 동급) sanitize 후 `dangerouslySetInnerHTML`. iframe 을 허용하므로 신뢰 도메인만 임베드되게 관리하세요.
- **CSS Modules 전제**: `.module.css` 를 쓰는 번들러(Vite/CRA/Next 등) 기준입니다. 일반 CSS로 쓰려면 `:global(...)` 을 벗기고 클래스명을 그대로(예: `.wrap`) 두면 됩니다.
```
