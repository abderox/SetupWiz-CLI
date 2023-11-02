import figlet from 'figlet';

export async function drawLogo(text) {
    return new Promise((resolve, reject) => {
        figlet.text(text, {
            font: 'Standard',
            horizontalLayout: 'default',
            verticalLayout: 'default',
            width: 80,
            whitespaceBreak: true
        }, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}