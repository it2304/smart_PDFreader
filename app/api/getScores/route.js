import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

export async function POST(req) {
    const { code_name } = await req.json();
    console.log('Received code_name:', code_name);

    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    try {
        const scoresIndex = pc.Index("scores");
        const response = await scoresIndex.fetch([code_name]);
        
        console.log('Pinecone response:', JSON.stringify(response, null, 2));

        if (response && response.vectors && response.vectors[code_name]) {
            const metadata = response.vectors[code_name].metadata;
            if (metadata && metadata.scores && Array.isArray(metadata.scores)) {
                const answers = metadata.scores.map((score, index) => ({
                    questionId: parseInt(metadata.questionIds[index], 10),
                    question: metadata.questions[index],
                    score: score,
                    explanation: metadata.explanations[index],
                    context: metadata.contexts[index],
                    // We don't have the full 'answer' field anymore, but it's composed of the above fields
                    answer: `Score: ${score}\nExplanation: ${metadata.explanations[index]}\nContext: ${metadata.contexts[index]}`
                }));
                return NextResponse.json({ answers });
            } else {
                console.log('Metadata structure is not as expected:', metadata);
                return NextResponse.json({ answers: [], error: 'Unexpected metadata structure' });
            }
        } else {
            console.log('No vector found for code_name:', code_name);
            return NextResponse.json({ answers: [], error: 'No data found for the given code_name' });
        }
    } catch (error) {
        console.error('Error fetching scores from Pinecone:', error);
        return NextResponse.json({ error: 'Failed to fetch scores', details: error.message }, { status: 500 });
    }
}