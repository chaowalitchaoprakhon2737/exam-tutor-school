const labels = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

const $ = s => document.querySelector(s);
const C = window.EXAM_CONFIG;
const S = supabase.createClient(
    C.supabaseUrl,
    C.supabaseAnonKey
);

let questions = [];
let timer = null;


/* =========================================
   ESCAPE HTML
========================================= */

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


/* =========================================
   SUPABASE RPC
========================================= */

async function rpc(name, args = {}) {

    const { data, error } =
        await S.rpc(name, args);

    if (error) {
        throw error;
    }

    return data;
}


/* =========================================
   LOGIN
========================================= */

$('#loginForm').onsubmit = async e => {

    e.preventDefault();

    $('#loginMsg').textContent = '';

    const { error } =
        await S.auth.signInWithPassword({
            email: $('#email').value,
            password: $('#password').value
        });

    if (error) {

        $('#loginMsg').textContent =
            error.message;

        return;
    }

    await openApp();
};


/* =========================================
   LOGOUT
========================================= */

$('#logout').onclick = async () => {

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    await S.auth.signOut();

    location.reload();
};


/* =========================================
   OPEN APP
========================================= */

async function openApp() {

    $('#loginView').hidden = true;
    $('#appView').hidden = false;

    await loadExam();
    await loadControl();
    await loadResults();

    if (timer) {
        clearInterval(timer);
    }

    timer = setInterval(
        async () => {

            await loadControl();

            if (!$('#results').hidden) {
                await loadResults();
            }

        },
        2500
    );
}


/* =========================================
   LOAD EXAM
========================================= */

async function loadExam() {

    try {

        const exam =
            await rpc(
                'teacher_exam_get'
            );

        if (exam) {

            $('#title').value =
                exam.title;

            $('#duration').value =
                exam.durationMinutes;

            questions =
                Array.isArray(exam.questions)
                    ? exam.questions
                    : [];

        } else {

            questions = [
                {
                    text: 'คำถามข้อ 1',

                    choices: [
                        'ตัวเลือก ก',
                        'ตัวเลือก ข',
                        'ตัวเลือก ค',
                        'ตัวเลือก ง'
                    ],

                    correct: 0
                }
            ];
        }

        renderEditor();

    } catch (error) {

        msg(error.message);
    }
}


/* =========================================
   QUESTION EDITOR
========================================= */

function renderEditor() {

    const container =
        $('#questionEditor');

    container.innerHTML = '';


    questions.forEach(
        (question, questionIndex) => {

            const article =
                document.createElement(
                    'article'
                );

            article.className =
                'qedit';


            article.innerHTML = `
                <div class="qhead">

                    <b>
                        ข้อ ${questionIndex + 1}
                    </b>

                    <button
                        type="button"
                        class="delete"
                    >
                        ลบ
                    </button>

                </div>

                <label>

                    คำถาม

                    <input
                        data-text
                        value="${esc(question.text)}"
                    >

                </label>

                ${
                    question.choices
                        .map(
                            (choice, index) => `
                                <div class="choice-edit">

                                    <input
                                        type="radio"
                                        name="r${questionIndex}"
                                        value="${index}"
                                        ${
                                            question.correct === index
                                                ? 'checked'
                                                : ''
                                        }
                                    >

                                    <b>
                                        ${labels[index] || index + 1}
                                    </b>

                                    <input
                                        data-c="${index}"
                                        value="${esc(choice)}"
                                    >

                                    <button
                                        type="button"
                                        data-rm="${index}"
                                    >
                                        ×
                                    </button>

                                </div>
                            `
                        )
                        .join('')
                }

                <button
                    type="button"
                    class="add-choice"
                >
                    + เพิ่มตัวเลือก
                </button>
            `;


            article
                .querySelector('.delete')
                .onclick = () => {

                    questions.splice(
                        questionIndex,
                        1
                    );

                    renderEditor();
                };


            article
                .querySelector('[data-text]')
                .oninput = e => {

                    question.text =
                        e.target.value;
                };


            article
                .querySelectorAll('[data-c]')
                .forEach(input => {

                    input.oninput = e => {

                        question.choices[
                            Number(e.target.dataset.c)
                        ] = e.target.value;
                    };

                });


            article
                .querySelectorAll(
                    'input[type="radio"]'
                )
                .forEach(radio => {

                    radio.onchange = e => {

                        question.correct =
                            Number(e.target.value);
                    };

                });


            article
                .querySelectorAll(
                    '[data-rm]'
                )
                .forEach(button => {

                    button.onclick = () => {

                        if (
                            question.choices.length <= 2
                        ) {

                            alert(
                                'ต้องมีอย่างน้อย 2 ตัวเลือก'
                            );

                            return;
                        }

                        question.choices.splice(
                            Number(button.dataset.rm),
                            1
                        );

                        question.correct = 0;

                        renderEditor();
                    };

                });


            article
                .querySelector(
                    '.add-choice'
                )
                .onclick = () => {

                    if (
                        question.choices.length >= 6
                    ) {

                        alert(
                            'เพิ่มได้สูงสุด 6 ตัวเลือก'
                        );

                        return;
                    }

                    question.choices.push(
                        'ตัวเลือกใหม่'
                    );

                    renderEditor();
                };


            container.appendChild(
                article
            );
        }
    );
}


/* =========================================
   ADD QUESTION
========================================= */

$('#addQuestion').onclick = () => {

    questions.push({
        text:
            `คำถามข้อ ${questions.length + 1}`,

        choices: [
            'ตัวเลือก ก',
            'ตัวเลือก ข',
            'ตัวเลือก ค',
            'ตัวเลือก ง'
        ],

        correct: 0
    });

    renderEditor();
};


/* =========================================
   SAVE EXAM
========================================= */

$('#saveExam').onclick = async () => {

    try {

        await rpc(
            'teacher_exam_save',
            {
                payload: {

                    title:
                        $('#title')
                            .value
                            .trim(),

                    durationMinutes:
                        Number(
                            $('#duration').value
                        ),

                    questions
                }
            }
        );

        msg(
            'บันทึกชุดข้อสอบแล้ว'
        );

        await loadExam();
        await loadControl();

    } catch (error) {

        msg(error.message);
    }
};


/* =========================================
   CONTROL
========================================= */

async function loadControl() {

    try {

        const data =
            await rpc(
                'teacher_control_state'
            );


        if (!data) {

            $('#controlBox').innerHTML = `
                <div class="waiting">

                    <h2>
                        ยังไม่มีชุดข้อสอบ
                    </h2>

                    <p>
                        ไปที่แท็บสร้างข้อสอบก่อน
                    </p>

                </div>
            `;

            return;
        }


        const status =
            data.sessionStatus ||
            'none';


        const currentPosition =
            Number(
                data.currentPosition ?? -1
            );


        const next =
            currentPosition + 2;


        $('#controlBox').innerHTML = `

            <div class="control-head">

                <div>

                    <h2>
                        ${esc(data.title)}
                    </h2>

                    <p class="muted">

                        ${data.total} ข้อ

                        •

                        ${
                            status === 'none'
                                ? 'ยังไม่มีรอบ'

                                : status === 'waiting'
                                    ? 'รอเริ่ม'

                                    : status === 'live'
                                        ? 'กำลังติว'

                                        : 'จบแล้ว'
                        }

                    </p>

                </div>


                <div class="actions">

                    ${
                        status === 'none' ||
                        status === 'finished'

                            ? `
                                <button
                                    id="startRound"
                                    class="primary"
                                    type="button"
                                >
                                    เริ่มรอบใหม่
                                </button>
                            `

                            : ''
                    }


                    ${
                        status === 'waiting'

                            ? `
                                <button
                                    id="releaseNext"
                                    class="primary"
                                    type="button"
                                >
                                    ส่งข้อ 1
                                </button>
                            `

                            : ''
                    }


                    ${
                        status === 'live' &&
                        next <= data.total

                            ? `
                                <button
                                    id="releaseNext"
                                    class="primary"
                                    type="button"
                                >
                                    ส่งข้อ ${next}
                                </button>
                            `

                            : ''
                    }


                    ${
                        status === 'live'

                            ? `
                                <button
                                    id="finishRound"
                                    type="button"
                                >
                                    จบการติว
                                </button>
                            `

                            : ''
                    }

                </div>

            </div>


            ${
                status === 'live'

                    ? `
                        <div class="stats">

                            <div class="stat">

                                <span>
                                    ข้อปัจจุบัน
                                </span>

                                <b>
                                    ${currentPosition + 1}
                                </b>

                            </div>


                            <div class="stat">

                                <span>
                                    ตอบแล้ว
                                </span>

                                <b>
                                    ${data.answeredCount}/${data.studentCount}
                                </b>

                            </div>


                            <div class="stat">

                                <span>
                                    ถูก
                                </span>

                                <b>
                                    ${data.correctCount}
                                </b>

                            </div>


                            <div class="stat">

                                <span>
                                    ผิด
                                </span>

                                <b>
                                    ${data.wrongCount}
                                </b>

                            </div>

                        </div>
                    `

                    : ''
            }

        `;


        /*
         * START ROUND
         */

        $('#startRound')
            ?.addEventListener(
                'click',
                async () => {

                    if (
                        !confirm(
                            'เริ่มรอบใหม่โดยใช้ชุดข้อสอบนี้?'
                        )
                    ) {
                        return;
                    }

                    try {

                        await rpc(
                            'teacher_round_start'
                        );

                        await loadControl();
                        await loadResults();

                    } catch (error) {

                        msg(error.message);
                    }
                }
            );


        /*
         * RELEASE NEXT
         */

        $('#releaseNext')
            ?.addEventListener(
                'click',
                async () => {

                    try {

                        await rpc(
                            'teacher_release_next'
                        );

                        await loadControl();
                        await loadResults();

                    } catch (error) {

                        msg(error.message);
                    }
                }
            );


        /*
         * FINISH
         */

        $('#finishRound')
            ?.addEventListener(
                'click',
                async () => {

                    if (
                        !confirm(
                            'จบการติวตอนนี้?'
                        )
                    ) {
                        return;
                    }

                    try {

                        await rpc(
                            'teacher_round_finish'
                        );

                        await loadControl();
                        await loadResults();

                    } catch (error) {

                        msg(error.message);
                    }
                }
            );


    } catch (error) {

        msg(error.message);
    }
}


/* =========================================
   RESULT ANSWER TAG
========================================= */

function renderAnswerTag(answer) {

    /*
     * SQL ใหม่ส่ง status=timeout
     *
     * SQL บางเวอร์ชันอาจไม่มี status
     * แต่ choice เป็น null/undefined
     *
     * ทั้งสองกรณีถือว่าไม่ได้ตอบ
     */

    if (
        answer.status === 'timeout' ||
        answer.choice === null ||
        answer.choice === undefined
    ) {

        return `
            <span
                class="tag timeout"
                title="หมดเวลา ข้อนี้ได้ 0 คะแนน"
            >
                ${answer.question}: ⏰ 0
            </span>
        `;
    }


    /*
     * ข้อปัจจุบัน
     * นักเรียนยังมีเวลาตอบ
     */

    if (
        answer.status === 'pending'
    ) {

        return `
            <span
                class="tag pending"
                title="ยังไม่ได้ตอบ"
            >
                ${answer.question}: รอตอบ
            </span>
        `;
    }


    /*
     * ครูยังไม่ได้ปล่อยข้อ
     */

    if (
        answer.status === 'not_released'
    ) {

        return `
            <span
                class="tag not-released"
                title="ครูยังไม่ได้ส่งข้อนี้"
            >
                ${answer.question}: -
            </span>
        `;
    }


    /*
     * มีคำตอบจริง
     */

    const choice =
        Number(
            answer.choice
        );


    const choiceLabel =
        labels[choice] ||
        '-';


    return `
        <span
            class="tag ${
                answer.correct
                    ? 'ok'
                    : 'no'
            }"
        >
            ${answer.question}:${choiceLabel}
            ${answer.correct ? '✓' : '✕'}
        </span>
    `;
}


/* =========================================
   RESULTS
========================================= */

async function loadResults() {

    try {

        const result =
            await rpc(
                'teacher_results'
            );


        const rows =
            Array.isArray(result)
                ? result
                : [];


        const done =
            rows.filter(
                student =>
                    student.finished
            ).length;


        $('#summary').textContent =
            `นักเรียน ${rows.length} คน • จบแล้ว ${done} คน`;


        if (
            rows.length === 0
        ) {

            $('#resultRows').innerHTML = `
                <tr>
                    <td colspan="6">
                        ยังไม่มีนักเรียน
                    </td>
                </tr>
            `;

            return;
        }


        $('#resultRows').innerHTML =
            rows.map(student => {


                /*
                 * ANSWERS
                 */

                const answers =
                    Array.isArray(
                        student.answers
                    )
                        ? student.answers
                        : [];


                const answersHtml =
                    answers
                        .map(
                            renderAnswerTag
                        )
                        .join('');


                /*
                 * ROW
                 */

                return `
                    <tr>

                        <td>
                            ${esc(
                                student.studentId
                            )}
                        </td>

                        <td>
                            ${esc(
                                student.studentName
                            )}
                        </td>

                        <td>
                            <b>
                                ${Number(student.score) || 0}/${Number(student.total) || 0}
                            </b>
                        </td>

                        <td>

                            <span
                                class="status ${
                                    student.finished
                                        ? 'done'
                                        : 'doing'
                                }"
                            >
                                ${
                                    student.finished
                                        ? 'จบแล้ว'
                                        : 'กำลังทำ'
                                }
                            </span>

                        </td>

                        <td>
                            ${
                                answersHtml ||
                                '<span class="muted">-</span>'
                            }
                        </td>

                        <td>

                            <button
                                type="button"
                                class="reset-one danger-btn"
                                data-id="${student.attemptId}"
                            >
                                รีเซ็ต
                            </button>

                        </td>

                    </tr>
                `;

            })
            .join('');


        /*
         * RESET รายคน
         */

        document
            .querySelectorAll(
                '.reset-one'
            )
            .forEach(button => {

                button.onclick =
                    async () => {

                        if (
                            !confirm(
                                'รีเซ็ตคะแนนนักเรียนคนนี้?'
                            )
                        ) {
                            return;
                        }


                        try {

                            await rpc(
                                'teacher_reset_attempt',
                                {
                                    p_attempt_id:
                                        button.dataset.id
                                }
                            );

                            await loadResults();
                            await loadControl();

                        } catch (error) {

                            msg(error.message);
                        }
                    };

            });


    } catch (error) {

        msg(error.message);
    }
}


/* =========================================
   REFRESH RESULTS
========================================= */

$('#refreshResults').onclick =
    loadResults;


/* =========================================
   CLEAR ALL RESULTS
========================================= */

$('#clearAll').onclick =
    async () => {

        if (
            !confirm(
                'เคลียร์คะแนนและคำตอบนักเรียนทั้งหมดในรอบนี้? การดำเนินการนี้ย้อนกลับไม่ได้'
            )
        ) {
            return;
        }


        try {

            await rpc(
                'teacher_clear_results'
            );

            await loadResults();
            await loadControl();

        } catch (error) {

            msg(error.message);
        }
    };


/* =========================================
   TABS
========================================= */

document
    .querySelectorAll(
        '.tab'
    )
    .forEach(button => {

        button.onclick =
            () => {


                document
                    .querySelectorAll(
                        '.tab'
                    )
                    .forEach(tab => {

                        tab.classList.toggle(
                            'active',
                            tab === button
                        );
                    });


                [
                    'control',
                    'builder',
                    'results'
                ]
                    .forEach(id => {

                        $('#' + id).hidden =
                            id !==
                            button.dataset.tab;
                    });


                if (
                    button.dataset.tab ===
                    'results'
                ) {

                    loadResults();
                }
            };
    });


/* =========================================
   MESSAGE
========================================= */

function msg(text) {

    $('#teacherMsg').textContent =
        text || '';


    setTimeout(
        () => {

            $('#teacherMsg').textContent =
                '';

        },
        3500
    );
}


/* =========================================
   RESTORE LOGIN SESSION
========================================= */

S.auth
    .getSession()
    .then(
        ({ data }) => {

            if (
                data.session
            ) {

                openApp();
            }
        }
    );