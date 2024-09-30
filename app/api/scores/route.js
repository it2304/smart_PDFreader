import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

export async function POST(req) {
    const { code_name } = await req.json();

    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    const scoresIndex = pc.Index("scores");
    const response = await scoresIndex.fetch([code_name]);

    if (response.vectors[code_name]) {
        return NextResponse.json(response.vectors[code_name].metadata);
    } else {
        return NextResponse.json({ error: "No data found for this company" }, { status: 404 });
    }
}