const labels = [
    'ก',
    'ข',
    'ค',
    'ง',
    'จ',
    'ฉ'
];


const $ = s =>
    document.querySelector(s);


const C =
    window.EXAM_CONFIG;


const S =
    supabase.createClient(
        C.supabaseUrl,
        C.supabaseAnonKey
    );


let token = null;

let lastKey = '';

let poller = null;

let countdownTimer = null;

let questionEndsAt = null;


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

async function rpc(
    name,
    args = {}
) {

    const {
        data,
        error
    } = await S.rpc(
        name,
        args
    );


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
            await rpc(
                'student_session_info'
            );


        if (!d) {

            throw Error(
                'ยังไม่มีรอบติวที่เปิดอยู่'
            );

        }


        $('#sessionInfo')
            .innerHTML = `

                <b>
                    ${esc(d.title)}
                </b>

                <br>

                ${d.questionCount} ข้อ

                •

                สถานะ ${
                    d.status === 'waiting'
                        ? 'รอเริ่ม'
                        : 'กำลังติว'
                }

            `;


    } catch (e) {

        $('#sessionInfo')
            .textContent =
            e.message;

    }

}


/* =========================
   TIME FORMAT
========================= */

function formatTime(
    totalSeconds
) {

    const seconds =
        Math.max(
            0,
            Math.floor(
                Number(
                    totalSeconds
                ) || 0
            )
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainingSeconds =
        seconds % 60;


    return (
        String(minutes)
            .padStart(2, '0')
        +
        ':'
        +
        String(remainingSeconds)
            .padStart(2, '0')
    );

}


/* =========================
   END TIME FORMAT
========================= */

function formatEndTime(
    date
) {

    if (
        !(date instanceof Date) ||
        Number.isNaN(
            date.getTime()
        )
    ) {

        return '--:--:--';

    }


    return date
        .toLocaleTimeString(
            'th-TH',
            {
                hour:
                    '2-digit',

                minute:
                    '2-digit',

                second:
                    '2-digit',

                hour12:
                    false
            }
        );

}


/* =========================
   STOP COUNTDOWN
========================= */

function stopCountdown() {

    if (countdownTimer) {

        clearInterval(
            countdownTimer
        );


        countdownTimer =
            null;

    }


    questionEndsAt =
        null;

}


/* =========================
   SHOW EXPIRED
========================= */

function showTimeExpired(
    endTimeText = ''
) {

    const stage =
        $('#stage');


    if (!stage) {
        return;
    }


    stage.innerHTML = `

        <div class="time-expired">

            <div class="expired-icon">
                ⏰
            </div>


            <h2>
                หมดเวลาข้อนี้แล้ว
            </h2>


            ${
                endTimeText
                    ? `

                        <div class="expired-time">

                            หมดเวลา

                            <b>
                                ${esc(
                                    endTimeText
                                )}
                            </b>

                        </div>

                    `
                    : ''
            }


            <p>
                ข้อนี้ได้
                <b>0 คะแนน</b>
            </p>


            <p>
                รอคุณครูส่งข้อถัดไป...
            </p>

        </div>

    `;

}


/* =========================
   START COUNTDOWN
========================= */

function startCountdown(
    remainingSeconds
) {

    stopCountdown();


    const seconds =
        Math.max(
            0,
            Number(
                remainingSeconds
            ) || 0
        );


    /*
     * คำนวณเวลาที่จะหมด
     */

    questionEndsAt =
        new Date(
            Date.now() +
            seconds * 1000
        );


    const endTimeText =
        formatEndTime(
            questionEndsAt
        );


    /*
     * ใส่เวลาที่จะหมด
     */

    const endElement =
        $('#questionEndTime');


    if (endElement) {

        endElement.textContent =
            endTimeText;

    }


    const updateCountdown =
        () => {


            const timerBox =
                $('#questionTimer');


            const timerText =
                $('#questionTimerText');


            if (
                !timerBox ||
                !timerText
            ) {

                stopCountdown();

                return;

            }


            const remaining =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            questionEndsAt.getTime() -
                            Date.now()
                        )
                        /
                        1000
                    )
                );


            timerText.textContent =
                formatTime(
                    remaining
                );


            /*
             * เหลือ <= 30 วินาที
             */

            timerBox
                .classList
                .toggle(
                    'warning',
                    remaining > 10 &&
                    remaining <= 30
                );


            /*
             * เหลือ <= 10 วินาที
             */

            timerBox
                .classList
                .toggle(
                    'danger',
                    remaining <= 10
                );


            /*
             * หมดเวลา
             */

            if (
                remaining <= 0
            ) {

                const expiredAt =
                    formatEndTime(
                        questionEndsAt
                    );


                stopCountdown();


                document
                    .querySelectorAll(
                        '.choice'
                    )
                    .forEach(
                        button => {

                            button.disabled =
                                true;

                        }
                    );


                showTimeExpired(
                    expiredAt
                );


                /*
                 * Sync state จริง
                 * จาก Supabase
                 */

                setTimeout(
                    () => {

                        lastKey =
                            '';

                        refresh();

                    },
                    500
                );

            }

        };


    /*
     * เรียกทันที
     */

    updateCountdown();


    /*
     * Update ทุก 1 วินาที
     */

    countdownTimer =
        setInterval(
            updateCountdown,
            1000
        );

}


/* =========================
   JOIN
========================= */

$('#joinForm')
    .onsubmit =
    async e => {


        e.preventDefault();


        $('#msg')
            .textContent =
            '';


        try {


            const studentId =
                $('#studentId')
                    .value
                    .trim();


            const studentName =
                $('#studentName')
                    .value
                    .trim();


            if (
                !studentId ||
                !studentName
            ) {

                $('#msg')
                    .textContent =
                    'กรุณากรอกข้อมูลให้ครบ';

                return;

            }


            const d =
                await rpc(
                    'student_join',
                    {
                        p_student_id:
                            studentId,

                        p_student_name:
                            studentName
                    }
                );


            token =
                d.token;


            lastKey =
                '';


            localStorage
                .setItem(
                    'examAttemptToken',
                    token
                );


            $('#joinView')
                .hidden =
                true;


            $('#playView')
                .hidden =
                false;


            await refresh();


            if (poller) {

                clearInterval(
                    poller
                );

            }


            poller =
                setInterval(
                    refresh,
                    2000
                );


        } catch (e) {


            $('#msg')
                .textContent =
                e.message;


        }

    };


/* =========================
   REFRESH
========================= */

async function refresh() {

    if (!token) {
        return;
    }


    try {


        const d =
            await rpc(
                'student_state',
                {
                    p_token:
                        token
                }
            );


        const key =
            JSON.stringify(
                d
            );


        $('#connection')
            .textContent =
            '● LIVE';


        /*
         * State ไม่เปลี่ยน
         * Countdown ของ JS
         * ยังทำงานต่อเอง
         */

        if (
            key === lastKey
        ) {

            return;

        }


        lastKey =
            key;


        render(
            d
        );


    } catch (e) {


        const message =
            String(
                e?.message || ''
            );


        /*
         * attempt ถูก Clear
         */

        if (
            message.includes(
                'ไม่พบ'
            )
            ||
            message
                .toLowerCase()
                .includes(
                    'not found'
                )
            ||
            message
                .toLowerCase()
                .includes(
                    'invalid token'
                )
        ) {

            await resetStudent();

            return;

        }


        $('#connection')
            .textContent =
            'เชื่อมต่อใหม่...';


        $('#msg')
            .textContent =
            message;

    }

}


/* =========================
   RENDER
========================= */

function render(
    d
) {

    const stage =
        $('#stage');


    stopCountdown();


    /* =====================
       PROGRESS
    ===================== */

    if (
        d.total
    ) {

        $('#progress')
            .textContent =

            d.status ===
            'finished'

                ? `จบการติว ${d.total} ข้อ`

                : `ข้อ ${Math.max(
                    0,
                    d.currentNumber
                )} จาก ${d.total}`;


        $('#progressBar')
            .style
            .width =

            `${
                (
                    Math.max(
                        0,
                        d.currentNumber
                    )
                    /
                    d.total
                )
                *
                100
            }%`;

    }


    /* =====================
       WAITING
    ===================== */

    if (
        d.status ===
        'waiting'
        ||
        d.currentNumber === 0
    ) {

        stage.innerHTML = `

            <div class="waiting">

                <span class="pulse">
                </span>

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


    /* =====================
       FINISHED
    ===================== */

    if (
        d.status ===
        'finished'
    ) {

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

                    จาก
                    ${d.total}

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


    /*
     * ตรวจว่ามี Timer
     */

    const hasTimer =
        d.remainingSeconds !==
            null
        &&
        d.remainingSeconds !==
            undefined;


    const remaining =
        Number(
            d.remainingSeconds
        );


    /*
     * คำนวณเวลาที่หมด
     */

    let currentEndTime =
        null;


    if (
        hasTimer &&
        Number.isFinite(
            remaining
        )
    ) {

        currentEndTime =
            new Date(
                Date.now() +
                Math.max(
                    0,
                    remaining
                )
                *
                1000
            );

    }


    const endTimeText =
        currentEndTime
            ?
            formatEndTime(
                currentEndTime
            )
            :
            '';


    /* =====================
       ANSWERED
    ===================== */

    if (
        d.answered
    ) {

        const cls =
            d.correct
                ?
                'ok'
                :
                'no';


        const icon =
            d.correct
                ?
                '🎉'
                :
                '💪';


        const title =
            d.correct

                ?
                'ถูกต้อง! เก่งมาก'

                :
                'ยังไม่ถูก ลุยข้อต่อไปนะ';


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

                                    ${labels[
                                        d.choice
                                    ] || ''}

                                    ${esc(
                                        d.choiceText
                                    )}

                                </b>

                            </div>

                        `

                        :
                        ''
                }


                <div class="answer-box">

                    เฉลย:

                    <b>

                        ${
                            labels[
                                d.correctChoice
                            ] || ''
                        }

                        ${esc(
                            d.correctText
                        )}

                    </b>

                </div>


                ${
                    endTimeText
                        ? `

                            <div class="answer-time">

                                ⏱ ข้อนี้หมดเวลา

                                <b>
                                    ${endTimeText}
                                </b>

                            </div>

                        `
                        :
                        ''
                }


                <p>

                    <span class="pulse">
                    </span>

                    รอคุณครูส่งข้อถัดไป...

                </p>

            </div>

        `;


        if (
            d.correct
        ) {

            confetti(
                stage.querySelector(
                    '.feedback'
                )
            );

        }


        return;

    }


    /* =====================
       TIME EXPIRED
    ===================== */

    if (
        d.timeExpired === true
        ||
        (
            hasTimer
            &&
            Number.isFinite(
                remaining
            )
            &&
            remaining <= 0
        )
    ) {

        showTimeExpired(
            endTimeText
        );

        return;

    }


    /* =====================
       QUESTION
    ===================== */

    stage.innerHTML = `

        <div class="question-card">


            ${
                hasTimer

                    ? `

                        <div
                            id="questionTimer"
                            class="question-timer"
                        >

                            <div class="timer-left">

                                <span>
                                    ⏱ เวลาที่เหลือ
                                </span>

                                <strong
                                    id="questionTimerText"
                                >
                                    ${
                                        formatTime(
                                            remaining
                                        )
                                    }
                                </strong>

                            </div>


                            <div class="timer-end">

                                <span>
                                    หมดเวลา
                                </span>

                                <b
                                    id="questionEndTime"
                                >
                                    ${
                                        endTimeText
                                    }
                                </b>

                            </div>

                        </div>

                    `

                    :
                    ''
            }


            <h2 class="question-text">

                ${d.currentNumber}.

                ${esc(
                    d.text
                )}

            </h2>


            <div id="choices">
            </div>

        </div>

    `;


    /* =====================
       CHOICE BUTTONS
    ===================== */

    if (
        Array.isArray(
            d.choices
        )
    ) {

        d.choices
            .forEach(
                (
                    choice,
                    index
                ) => {


                    const button =
                        document
                            .createElement(
                                'button'
                            );


                    button.type =
                        'button';


                    button.className =
                        'choice';


                    button.innerHTML = `

                        <span class="label">

                            ${
                                labels[
                                    index
                                ] || ''
                            }

                        </span>


                        <span>

                            ${esc(
                                choice
                            )}

                        </span>

                    `;


                    button.onclick =
                        () =>
                            answer(
                                index
                            );


                    $('#choices')
                        .appendChild(
                            button
                        );

                }
            );

    }


    /* =====================
       START COUNTDOWN
    ===================== */

    if (
        hasTimer
        &&
        Number.isFinite(
            remaining
        )
        &&
        remaining > 0
    ) {

        startCountdown(
            remaining
        );

    }

}


/* =========================
   ANSWER
========================= */

async function answer(
    choiceIndex
) {

    stopCountdown();


    document
        .querySelectorAll(
            '.choice'
        )
        .forEach(
            button => {

                button.disabled =
                    true;

            }
        );


    try {


        await rpc(
            'student_answer',
            {
                p_token:
                    token,

                p_choice:
                    choiceIndex
            }
        );


        lastKey =
            '';


        await refresh();


    } catch (e) {


        const message =
            String(
                e?.message || ''
            );


        $('#msg')
            .textContent =
            message;


        /*
         * หมดเวลา
         */

        if (
            message.includes(
                'หมดเวลา'
            )
        ) {

            lastKey =
                '';


            await refresh();


            return;

        }


        /*
         * Error อื่น
         * เปิดปุ่มอีกครั้ง
         */

        document
            .querySelectorAll(
                '.choice'
            )
            .forEach(
                button => {

                    button.disabled =
                        false;

                }
            );

    }

}


/* =========================
   START AGAIN
========================= */

async function startAgain() {

    stopCountdown();


    if (
        poller
    ) {

        clearInterval(
            poller
        );


        poller =
            null;

    }


    token =
        null;


    lastKey =
        '';


    localStorage
        .removeItem(
            'examAttemptToken'
        );


    $('#playView')
        .hidden =
        true;


    $('#joinView')
        .hidden =
        false;


    $('#msg')
        .textContent =
        '';


    $('#studentId')
        .value =
        '';


    $('#studentName')
        .value =
        '';


    $('#progress')
        .textContent =
        'รอเริ่ม';


    $('#progressBar')
        .style
        .width =
        '0%';


    await info();

}


/* =========================
   RESET STUDENT
========================= */

async function resetStudent() {

    stopCountdown();


    if (
        poller
    ) {

        clearInterval(
            poller
        );


        poller =
            null;

    }


    token =
        null;


    lastKey =
        '';


    localStorage
        .removeItem(
            'examAttemptToken'
        );


    $('#playView')
        .hidden =
        true;


    $('#joinView')
        .hidden =
        false;


    $('#msg')
        .textContent =
        '';


    $('#progress')
        .textContent =
        'รอเริ่ม';


    $('#progressBar')
        .style
        .width =
        '0%';


    await info();

}


/* =========================
   CONFETTI
========================= */

function confetti(
    box
) {

    if (!box) {
        return;
    }


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
            document
                .createElement(
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
            0.35 +
            's';


        box.appendChild(
            x
        );

    }

}


/* =========================
   INITIAL LOAD
========================= */

info();


const saved =
    localStorage
        .getItem(
            'examAttemptToken'
        );


if (
    saved
) {

    token =
        saved;


    $('#joinView')
        .hidden =
        true;


    $('#playView')
        .hidden =
        false;


    refresh()
        .then(
            () => {

                if (
                    token
                ) {

                    poller =
                        setInterval(
                            refresh,
                            2000
                        );

                }

            }
        )
        .catch(
            async () => {

                await resetStudent();

            }
        );

}