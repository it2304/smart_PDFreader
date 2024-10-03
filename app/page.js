'use client'
import { useState, useEffect } from "react";
import { Box, Paper, Typography, useMediaQuery, Switch, Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Button, TextField } from "@mui/material";
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const isMobile = useMediaQuery('(max-width:600px)');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (!response.ok) throw new Error('Failed to fetch companies');
      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCompanySelect = async (event) => {
    const selectedCompanyName = event.target.value;
    setSelectedCompany(selectedCompanyName);
    await processCompany(selectedCompanyName);
  };

  const handleNewCompanySubmit = async (event) => {
    event.preventDefault();
    if (newCompanyName.trim()) {
      await processCompany(newCompanyName.trim());
      setNewCompanyName('');
    }
  };

  const processCompany = async (companyName) => {
    setLoading(true);
    const companyCodeName = companyName.toLowerCase().replace(/\s+/g, '--');

    try {
      console.log("Processing company:", companyName);

      const currentUrl = window.location.origin;
      console.log("Current URL from page:", currentUrl);
      
      // First, check if scores exist for the selected company
      const scoresResponse = await fetch('/api/getScores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_name: companyCodeName }),
      });

      if (scoresResponse.ok) {
        const scoresData = await scoresResponse.json();
        if (scoresData.answers && scoresData.answers.length > 0) {
          // If scores exist, use them
          setAnswers(scoresData.answers);
          setLoading(false);
          return;
        }
      }

      // If no scores exist, proceed with chat
      let chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_name: companyCodeName, currentUrl: currentUrl }),
      });

      if (!chatResponse.ok) throw new Error('Failed to process questions');
      const data = await chatResponse.json();
      console.log('Chat API response:', data);
      setAnswers(data.answers);
    } catch (error) {
      console.error('Error processing company data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyScores = () => {
    const scores = answers.map(answer => answer.score).join('\t');
    navigator.clipboard.writeText(scores).then(() => {
      alert('Scores copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy scores: ', err);
    });
  };

  const handleCopyExplanantions = () => {
    const explanantions = answers.map(answer => answer.explanation).join('\t');
    navigator.clipboard.writeText(explanantions).then(() => {
      alert('Scores copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy scores: ', err);
    });
  };

  const handleCopyContext = () => {
    const context = answers.map(answer => answer.context).join('\t');
    navigator.clipboard.writeText(context).then(() => {
      alert('Scores copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy scores: ', err);
    });
  };

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Company Analysis</Typography>
          <Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="company-select-label">Select a Company</InputLabel>
            <Select
              labelId="company-select-label"
              id="company-select"
              value={selectedCompany}
              label="Select a Company"
              onChange={handleCompanySelect}
            >
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.name}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <form onSubmit={handleNewCompanySubmit}>
            <TextField
              label="Enter a new company name"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              sx={{ width: '100%' }}
            />
          </form>
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {answers.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>Scores Summary</Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        {answers.map((answer) => (
                          <TableCell key={answer.questionId}>{
                              answer.score || 'N/A'
                            }</TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button variant="contained" onClick={handleCopyScores} sx={{ mt: 1 }}>
                  Copy Scores
                </Button>
                <Button variant="contained" onClick={handleCopyExplanantions} sx={{ mt: 1 }}>
                  Copy Explanantions
                </Button>
                <Button variant="contained" onClick={handleCopyContext} sx={{ mt: 1 }}>
                  Copy Context
                </Button>
              </Box>
            )}
            
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell>Question#</TableCell>
                    <TableCell>Question</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Explanation</TableCell>
                    <TableCell>Context</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {answers.map((answer) => {
                    console.log('Rendering answer:', answer);
                    return (
                      <TableRow key={answer.questionId}>
                        <TableCell>{answer.questionId}</TableCell>
                        <TableCell>{answer.question}</TableCell>
                        <TableCell>{answer.score || 'N/A'}</TableCell>
                        <TableCell>{answer.explanation || 'No explanation provided'}</TableCell>
                        <TableCell>{answer.context || 'No context provided'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>
    </ThemeProvider>
  );
}