export default function handler(_req: any, res: any) {
    res.status(200).json({ ping: 'pong', time: new Date().toISOString() });
}
