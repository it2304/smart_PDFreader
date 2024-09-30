import { Pinecone } from "@pinecone-database/pinecone";

export async function GET() {
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    try {
        // Connect to the 'companies' index
        const index = pc.Index("companies");

        // Query all vectors in the index
        const queryResult = await index.query({
            topK: 50, // Adjust this number based on how many companies you expect
            includeMetadata: true,
            vector: new Array(1).fill(0), // Assuming 1536-dimensional vectors, adjust if different
        });

        //console.log('Query result:', queryResult); // Debug log
        //console.log('Query result:', JSON.stringify(queryResult, null, 2)); // Debug log

        // Extract the companies from the query result
        const companies = queryResult.matches.map(match => ({
            id: match.id,
            name: match.metadata.name || 'Unknown Company',
            code_name: match.metadata.code_name || 'Unknown Code Name',
            is_ready: match.metadata.is_ready || false,
            is_graded: match.metadata.is_graded || false,
        }))
        .sort((a, b) => Number(a.id) - Number(b.id));

        //console.log('Formatted companies:', companies); // Debug log

        // Return the response as JSON
        return new Response(JSON.stringify(companies), {
            headers: { 'Content-Type': 'application/json' },

        });
    } catch (error) {
        console.error('Error fetching companies from Pinecone:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch companies', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
