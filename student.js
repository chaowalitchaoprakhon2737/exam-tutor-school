const labels = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

const $ = s => document.querySelector(s);
const C = window.EXAM_CONFIG;
const S = supabase.createClient(
    C.supabaseUrl,
    C.supabaseAnonKey
);

let token = null;
let lastKey = '';
let poller = null;


/* =========================
   ESCAPE HTML
========================= */

const esc = s =>
    String(s ?? '').replace(
        /[&<>"']/g,
        c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c])
    );


/* =========================
   SUPABASE RPC
========================= */

async function rpc(n, a = {}) {

    const { data, error } =
        await S.rpc(n, a);

    if (error) {
        throw error;
    }

    return data;
}


/* =========================
   SESSION INFO
========================= */

async function info() {

    try {

        const d =
            await rpc('student_session_info');

        if (!d) {
            throw Error(
                'ยังไม่มีรอบติวที่เปิดอยู่'
            );
        }

        $('#sessionInfo').innerHTML = `
            <b>${esc(d.title)}</b><br>
            ${d.questionCount} ข้อ •
            สถานะ ${
                d.status === 'waiting'
                    ? 'รอเริ่ม'
                    : 'กำลังติว'
            }
        `;

    } catch (e) {

        $('#sessionInfo').textContent =
            e.message;

    }

}


/* =========================
   JOIN EXAM
========================= */

$('#joinForm').onsubmit = async e => {

    e.preventDefault();

    $('#msg').textContent = '';

    try {

        const d = await rpc(
            'student_join',
            {
                p_student_id:
                    $('#studentId')
                        .value
                        .trim(),

                p_student_name:
                    $('#studentName')
                        .value
                        .trim()
            }
        );

        token = d.token;
        lastKey = '';

        localStorage.setItem(
            'examAttemptToken',
            token
        );

        $('#joinView').hidden = true;
        $('#playView').hidden = false;

        await refresh();

        if (poller) {
            clearInterval(poller);
        }

        poller =
            setInterval(
                refresh,
                2000
            );

    } catch (e) {

        $('#msg').textContent =
            e.message;

    }

};


/* =========================
   REFRESH STATE
========================= */

async function refresh() {

    if (!token) {
        return;
    }

    try {

        const d = await rpc(
            'student_state',
            {
                p_token: token
            }
        );

        const key =
            JSON.stringify(d);

        $('#connection').textContent =
            'LIVE';

        if (key === lastKey) {
            return;
        }

        lastKey = key;

        render(d);

    } catch (e) {

        $('#connection').textContent =
            'เชื่อมต่อใหม่...';

        $('#msg').textContent =
            e.message;

    }

}


/* =========================
   RENDER
========================= */

function render(d) {

    const stage =
        $('#stage');


    /* -------------------------
       PROGRESS
    ------------------------- */

    if (d.total) {

        $('#progress').textContent =
            d.status === 'finished'
                ? `จบการติว ${d.total} ข้อ`
                : `ข้อ ${Math.max(
                    0,
                    d.currentNumber
                )} จาก ${d.total}`;

        $('#progressBar').style.width =
            `${
                Math.max(
                    0,
                    d.currentNumber
                ) /
                d.total *
                100
            }%`;

    }


    /* -------------------------
       WAITING
    ------------------------- */

    if (
        d.status === 'waiting' ||
        d.currentNumber === 0
    ) {

        stage.innerHTML = `
            <div class="waiting">

                <span class="pulse"></span>

                <h2>
                    เข้าร่วมแล้ว
                </h2>

                <p>
                    รอคุณครูเริ่มข้อ 1...
                </p>

            </div>
        `;

        return;
    }


    /* -------------------------
       FINISHED
    ------------------------- */

    if (d.status === 'finished') {

        stage.innerHTML = `
            <div class="feedback ok">

                <div class="feedback-icon">
                    🏆
                </div>

                <h2>
                    จบการติวแล้ว
                </h2>

                <div class="score-ring">

                    <b>
                        ${d.score}
                    </b>

                    จาก ${d.total}

                </div>

                <p>
                    ทำได้ดีมาก
                    ขอบคุณที่ตั้งใจเรียน!
                </p>

                <button
                    type="button"
                    class="primary wide"
                    onclick="startAgain()"
                >
                    เริ่มใหม่ →
                </button>

            </div>
        `;

        return;
    }


    /* -------------------------
       ANSWERED
    ------------------------- */

    if (d.answered) {

        const cls =
            d.correct
                ? 'ok'
                : 'no';

        const icon =
            d.correct
                ? '🎉'
                : '💪';

        const title =
            d.correct
                ? 'ถูกต้อง! เก่งมาก'
                : 'ยังไม่ถูก ลุยข้อต่อไปนะ';


        stage.innerHTML = `
            <div class="feedback ${cls}">

                <div class="feedback-icon">
                    ${icon}
                </div>

                <h2>
                    ${title}
                </h2>

                ${
                    !d.correct
                        ? `
                            <div class="answer-box">

                                คำตอบของคุณ:

                                <b>
                                    ${labels[d.choice]}
                                    ${esc(d.choiceText)}
                                </b>

                            </div>
                        `
                        : ''
                }

                <div class="answer-box">

                    เฉลย:

                    <b>
                        ${labels[d.correctChoice]}
                        ${esc(d.correctText)}
                    </b>

                </div>

                <p>
                    <span class="pulse"></span>
                    รอคุณครูส่งข้อถัดไป...
                </p>

            </div>
        `;


        if (d.correct) {

            confetti(
                stage.querySelector(
                    '.feedback'
                )
            );

        }

        return;
    }


    /* -------------------------
       QUESTION
    ------------------------- */

    stage.innerHTML = `
        <div class="question-card">

            <h2 class="question-text">
                ${d.currentNumber}.
                ${esc(d.text)}
            </h2>

            <div id="choices"></div>

        </div>
    `;


    d.choices.forEach(
        (c, i) => {

            const b =
                document.createElement(
                    'button'
                );

            b.className =
                'choice';

            b.innerHTML = `
                <span class="label">
                    ${labels[i]}
                </span>

                <span>
                    ${esc(c)}
                </span>
            `;

            b.onclick =
                () => answer(i);

            $('#choices')
                .appendChild(b);

        }
    );

}


/* =========================
   ANSWER
========================= */

async function answer(i) {

    document
        .querySelectorAll(
            '.choice'
        )
        .forEach(
            b =>
                b.disabled = true
        );

    try {

        await rpc(
            'student_answer',
            {
                p_token: token,
                p_choice: i
            }
        );

        lastKey = '';

        await refresh();

    } catch (e) {

        $('#msg').textContent =
            e.message;

        document
            .querySelectorAll(
                '.choice'
            )
            .forEach(
                b =>
                    b.disabled = false
            );

    }

}


/* =========================
   START AGAIN
========================= */

async function startAgain() {

    /*
     * หยุด polling รอบเก่า
     */

    if (poller) {

        clearInterval(
            poller
        );

        poller = null;

    }


    /*
     * ล้างข้อมูลรอบเก่า
     */

    token = null;
    lastKey = '';

    localStorage.removeItem(
        'examAttemptToken'
    );


    /*
     * กลับหน้า Login นักเรียน
     */

    $('#playView').hidden = true;
    $('#joinView').hidden = false;

    $('#msg').textContent = '';


    /*
     * ล้างข้อมูลนักเรียน
     */

    $('#studentId').value = '';
    $('#studentName').value = '';


    /*
     * Reset progress
     */

    $('#progress').textContent =
        'รอเริ่ม';

    $('#progressBar').style.width =
        '0%';


    /*
     * โหลดข้อมูลรอบล่าสุด
     */

    await info();

}


/* =========================
   CONFETTI
========================= */

function confetti(box) {

    const colors = [
        '#ffca3a',
        '#ff595e',
        '#8ac926',
        '#1982c4',
        '#6a4c93'
    ];

    for (
        let i = 0;
        i < 32;
        i++
    ) {

        const x =
            document.createElement(
                'i'
            );

        x.className =
            'confetti';

        x.style.left =
            Math.random() *
            100 +
            '%';

        x.style.background =
            colors[
                i %
                colors.length
            ];

        x.style.animationDelay =
            Math.random() *
            .35 +
            's';

        box.appendChild(x);

    }

}


/* =========================
   INITIAL LOAD
========================= */

info();


const saved =
    localStorage.getItem(
        'examAttemptToken'
    );


if (saved) {

    token = saved;

    $('#joinView').hidden = true;
    $('#playView').hidden = false;


    refresh()
        .then(() => {

            if (token) {

                poller =
                    setInterval(
                        refresh,
                        2000
                    );

            }

        })
        .catch(() => {

            localStorage.removeItem(
                'examAttemptToken'
            );

        });

}