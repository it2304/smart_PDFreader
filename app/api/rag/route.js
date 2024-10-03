import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OpenAI } from "openai";

export const maxDuration = 60;

export async function POST(req) {
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const { code_name, questions } = await req.json();
        console.log("Fetching RAG data for code_name:", code_name);
        //console.log("Received questions:", questions);

        if (!Array.isArray(questions)) {
            throw new Error('Questions must be an array');
        }

        const index = pc.Index("rag");
        //const indexDescription = await pc.describeIndex("rag");
        //console.log("Index Description:", indexDescription);
        console.log("Successfully connected to Pinecone rag index");
        

        const ragData = [];

        for (const question of questions) {
            //console.log(question.question)
            const questionEmbedding = await openai.embeddings.create({
                input: question.question,
                model: "text-embedding-3-small"
            });
            //console.log(questionEmbedding)
            //console.log(typeof code_name)

            console.log("api/rag: created question embedding")

            //const statsResponse = await index.describeIndexStats({
            //    filter: { namespace: code_name }
            //});
            //console.log("Namespace stats:", statsResponse);

            const queryResult = await index.namespace(code_name).query({
                topK: 10, // Reduced from 15 to 5 for efficiency
                includeMetadata: true,
                vector: questionEmbedding.data[0].embedding,
            });

            console.log("api/rag: queryResult retrieved")

            //console.log("Question embedding dimension:", questionEmbedding.data[0].embedding);
            //console.log(queryResult)

            const relevantData = queryResult.matches.map(match => ({
                id: match.id,
                text: match.metadata.text || '',
                pdf_name: match.metadata.pdf_name || '',
                page_num: match.metadata.page_num || '',
                similarity: match.score,
                questionId: question.id
            }));

            console.log("api/rag: relevantData retrieved")

            ragData.push(...relevantData);
        }

        console.log(`Retrieved ${ragData.length} relevant RAG data items for ${code_name}`);
        return new Response(JSON.stringify(ragData), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Error fetching RAG data from Pinecone:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch RAG data', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}