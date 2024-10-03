import { NextResponse } from "next/server";
import { OpenAI } from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";

const systemPrompt = `
You are an intelligent assistant whose purpose is to answer questions solely based on the provided text-embedding data and question guidelines. 
Follow these strict guidelines:

Consultation keywords: You should retain a basic understanding of the keywords and acronyms that can be found in the provided text or 
that can pertain to the field of consultations and sustainability. One term is "LAC" which stands for Latin American Countries and 
refers to any of the known Latin American Countries.

Context-Based Responses: Use your knowleddge of the field of consultations to understand the questions, but you must only use the information 
present in the provided embeddings for answering questions. 

No External Knowledge: Do not rely on external knowledge, personal assumptions, or general knowledge. 
Base all responses strictly on the content encoded in the embeddings and the provided question guidelines.

Concise & Accurate Answers: Provide concise, accurate, and clear responses. Avoid adding unnecessary details or going beyond the provided data.

Clarifications on Data Insufficiency: If the user's question requires information beyond the embeddings, 
clearly state that and suggest possible ways the user could provide additional data if relevant.

Consistent with Data Format: If the embeddings contain structured information, such as named entities, 
dates, or specific terms, refer to these explicitly as they appear in the embeddings.

Response Guidelines: For each question, consider the provided type, criteria, guide, and definitions. Ensure your answer aligns with these guidelines.
The type tells you how the questions should be answered (either graded between 1-2 or boolean).
The criteria tells you how to answer the question and what scores to provide for which considerations.
The guide for each questions tells you more about what to look for when answering the question.
The definitions provide more context about the question and any specific terms.

Your answer should be in the following format for each question:
---
Score: Provide the score for the question based on the type, criteria and guide
Explanation: Provide an explanation for the score based on the provided context, guide and definitions
Context: List the PDF names and page numbers used to answer this question, in the format [PDF_Name: Page_Num]
---

It is possible that the context provided does not contain the answer to the question. If this is the case, 
In that case, provide a score of 0 and explain why the context does not contain the answer.


Maintain professionalism and accuracy at all times while adhering to these rules.
`;

export async function POST(req) {
    console.log("POST request received in /api/chat");

    if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY is not set");
        return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("OpenAI instance created");

    try {
        // Fetch questions from the scoring-guide index
        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
        console.log("Pinecone instance created");

        const questionsIndex = pc.Index("scoring-guide");
        console.log("Accessing 'scoring-guide' index");

        const questionsResponse = await questionsIndex.query({
            vector: new Array(1).fill(0),
            topK: 40,
            includeMetadata: true,
        });
        console.log("Questions retrieved from Pinecone");

        const questions = questionsResponse.matches.map(match => ({
            id: parseInt(match.metadata.question_num, 10),
            question: match.metadata.question,
            type: match.metadata.type,
            criteria: match.metadata.criteria,
            guide: match.metadata.guide,
            definitions: match.metadata.definitions,
        })).sort((a, b) => a.id - b.id);

        console.log(`Processed ${questions.length} questions`);

        const fullSystemPrompt = systemPrompt + JSON.stringify(questions, null, 2);
        console.log("Full system prompt created");

        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            model: "text-embedding-3-small"
        });
        console.log("OpenAIEmbeddings instance created");

        const { code_name, currentUrl } = await req.json();
        console.log("Received code_name:", code_name);
        console.log("Received currentUrl:", currentUrl);

        //console.warn("What I am getting:", req.headers.host, "and", req.headers["x-forwarded-proto"]);
        //console.log("All headers:", JSON.stringify(req, null, 2));

        //const host = req.headers.host || 'localhost:3000';
        //const protocol = req.headers["x-forwarded-proto"] || 'http';
        //console.log(`Constructed base URL: ${protocol}://${host}`);

        let ragResponse;
        try {
            ragResponse = await fetch(`${currentUrl}/api/rag`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_name, questions }),
            });
            console.log('RAG API called successfully');
        } catch (error) {
            console.error('Error calling RAG API:', error);
            throw new Error('Failed to fetch RAG data');
        }

        if (!ragResponse.ok) {
            const errorText = await ragResponse.text();
            console.error('RAG response error:', errorText);
            throw new Error('Failed to fetch RAG data');
        }

        const ragData = await ragResponse.json();
        console.log('RAG data retrieved successfully');

        const answers = [];
        const scores = [];
        const explanations = [];
        const contexts = [];

        for (const q of questions) {
            console.log(`Processing question ${q.id}`);

            const relevantContext = ragData.filter(item => item.questionId === q.id);
            console.log(`Found ${relevantContext.length} relevant contexts for question ${q.id}`);

            let contextString = `Context for question ${q.id}:\n\n`;
            relevantContext.forEach((item, index) => {
                contextString += `Context ${index + 1}: ${item.text} [${item.pdf_name}: ${item.page_num}] (Similarity: ${item.similarity.toFixed(4)})\n\n`;
            });

            const message = `
                Question ${q.id}: ${q.question}
                Type: ${q.type}
                Criteria: ${q.criteria}
                Guide: ${q.guide}
                Definitions: ${q.definitions}

                ${contextString}

                Please provide an answer based on the above information. If the context does not contain sufficient information to answer the question, clearly state that in your response.`;

            console.log(`Sending question ${q.id} to OpenAI`);
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: fullSystemPrompt },
                    { role: "user", content: message }
                ],
                model: "gpt-4o-mini",
            });
            console.log(`Received answer for question ${q.id} from OpenAI`);

            const answer = completion.choices[0].message.content;

            const parts = answer.split('---');
            if (parts.length > 1) {
                const contentPart = parts[1].trim();
                const lines = contentPart.split('\n').filter(line => line.trim() !== '');
                
                const scoreLine = lines.find(line => line.startsWith('Score:'));
                const explanationLine = lines.find(line => line.startsWith('Explanation:'));
                const contextLine = lines.find(line => line.startsWith('Context:'));
                
                const score = scoreLine ? scoreLine.replace('Score:', '').trim() : '';
                const explanation = explanationLine ? explanationLine.replace('Explanation:', '').trim() : '';
                const context = contextLine ? contextLine.replace('Context:', '').trim() : '';

                scores.push(score);
                explanations.push(explanation);
                contexts.push(context);

                answers.push({
                    questionId: q.id,
                    question: q.question,
                    score: score,
                    explanation: explanation,
                    context: context
                });
                console.log(`Processed answer for question ${q.id}`);
            } else {
                console.log(`No valid answer format for question ${q.id}`);
                scores.push('N/A');
                explanations.push('No explanation provided');
                contexts.push('No context provided');

                answers.push({
                    questionId: q.id,
                    question: q.question,
                    score: 'N/A',
                    explanation: 'No explanation provided',
                    context: 'No context provided'
                });
            }
        }

        console.log('Updating scores in Pinecone');
        const scoresIndex = pc.Index("scores");
        await scoresIndex.upsert([{
            id: code_name,
            values: [0.55],
            metadata: {
                scores: scores,
                explanations: explanations,
                contexts: contexts,
                questions: answers.map(a => a.question)
            }
        }]);
        console.log('Scores updated in Pinecone');

        answers.sort((a, b) => a.questionId - b.id);
        console.log(`Returning ${answers.length} answers`);

        return NextResponse.json({ answers });
    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}