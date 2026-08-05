```html
<!DOCTYPE html>
<html>
<head>
<style>
.cm-poster-edit{
    width:300px;
    background:#FFFFFF;
    border:1px solid #afafaf;
    border-radius:18px;
    padding:12px;
    font-family:Arial,sans-serif;
    color:#555;
    box-sizing:border-box;
}

/* Hint */

.cm-edit-hint{
    text-align:center;
    color:#b0b0b0;
    font-size:12px;
    animation:cmHintBlink 2.4s infinite ease-in-out;
}

@keyframes cmHintBlink{

    0%{
        color:#b0b0b0;
    }

    40%{
        color:#b0b0b0;
    }

    50%{
        color:#000;
    }

    60%{
        color:#b0b0b0;
    }

    100%{
        color:#b0b0b0;
    }

}

/* ---------- Top Row ---------- */

.cm-row{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    margin-top:20px;
}

.cm-row-left{
    display:flex;
    gap:10px;
    align-items:flex-start;
}

.cm-stack{
    display:flex;
    flex-direction:column;
    align-items:flex-start;
}

.cm-color{
    width:45px;
    height:38px;
    border:1px solid #111;
    border-radius:12px;
    background:#fff;
    box-sizing:border-box;
}

.cm-color.title{
    background:#5a451b;
}

.cm-label{
    margin-top:5px;
    font-weight:550;
    color:#444;
    text-align:left;
    width:100%;
}

/* ---------- Dropdowns ---------- */

.cm-order,
.cm-aspect{
    width:72px;
    height:30px;
    border:1.3px solid #111;
    border-radius:10px;
    padding:0 10px;
    box-sizing:border-box;
    background:#fff;
}

.cm-muted{
    margin-top:5px;
    color:#999;
    font-size:13px;
    text-align:left;
    width:100%;
}

/* ---------- Text Field ---------- */

.cm-edit-text{
    margin-top:24px;
    width:100%;
    box-sizing:border-box;
    border:1px solid #111;
    border-radius:14px;
    padding:10px;
    font-size:15px;
    outline:none;
}

/* ---------- Bottom Row ---------- */

.cm-bottom{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:10px;
    margin-top:24px;
}

.cm-edit-upload{
    flex:1;
    border:none;
    border-radius:39px;
    padding:10px;
    background:#f1f1f1;
    box-shadow:0 4px 8px rgba(0,0,0,.18);
    font-weight:800;
    font-size:18px;
    color:#414141;
    cursor:pointer;
}
</style>
</head>

<body>

<div class="cm-poster-edit">

    <div class="cm-edit-hint">
        click poster to edit content
    </div>

    <div class="cm-row">

        <div class="cm-row-left">

            <div class="cm-stack">
                <div class="cm-color"></div>
                <div class="cm-label">Poster</div>
            </div>

            <div class="cm-stack">
                <div class="cm-color title"></div>
                <div class="cm-label">Title</div>
            </div>

        </div>

        <div class="cm-stack">
            <select class="cm-order">
                <option>1</option>
            </select>

            <div class="cm-muted">
                order
            </div>
        </div>

    </div>

    <input
        class="cm-edit-text"
        placeholder="Enter Poster Title"
    >

    <div class="cm-bottom">

        <button class="cm-edit-upload">
            EDIT BLOB IMAGE
        </button>

        <div class="cm-stack">

            <select class="cm-aspect">
                <option>3/4</option>
            </select>

            <div class="cm-muted">
                aspect ratio
            </div>

        </div>

    </div>

</div>

</body>
</html>
```
