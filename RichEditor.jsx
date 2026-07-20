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
