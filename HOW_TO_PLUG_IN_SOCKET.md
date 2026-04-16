# How to Plug in Socket Integration

You need to add three small changes into your `public/js/host.js` file to emit drawing events.

1. **Emit Drawing**: 
Find the function where you actually draw points on the canvas (`ctx.lineTo()`, `ctx.stroke()`, etc.) or when you receive tracking data, and add this line inside:
```javascript
if (window.socketEmitDraw) {
    window.socketEmitDraw(x, y, px, py, color, brushSize, mode);
}
```

2. **Emit Clear Canvas**: 
Find the click event listener for your `clearCanvasBtn` and add this inside it:
```javascript
if (window.socketEmitClear) window.socketEmitClear();
```

3. **Emit Undo**: 
Find the click event listener for your `undoBtn` and add this inside it:
```javascript
if (window.socketEmitUndo) window.socketEmitUndo();
```
