import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Download, TrendingUp, Users, Target, BarChart3 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface RecommendationStats {
  totalRecommendations: number;
  averageScore: number;
  uniqueUsers: number;
  topScholarships: { id: string; titre: string; count: number }[];
  scoreDistribution: { range: string; count: number }[];
}

export default function Admin() {
  const navigate = useNavigate();
  const [isScrapingAll, setIsScrapingAll] = useState(false);
  const [isScrapingCustom, setIsScrapingCustom] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
        if (!data) navigate("/");
        else fetchStats();
      });
    });
  }, [navigate]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      // Fetch all recommendations
      const { data: recommendations, error } = await supabase
        .from('recommendations')
        .select('*, bourse_id');

      if (error) throw error;

      if (!recommendations || recommendations.length === 0) {
        setStats({
          totalRecommendations: 0,
          averageScore: 0,
          uniqueUsers: 0,
          topScholarships: [],
          scoreDistribution: []
        });
        return;
      }

      // Calculate stats
      const totalRecommendations = recommendations.length;
      const averageScore = recommendations.reduce((sum, rec) => sum + Number(rec.score), 0) / totalRecommendations;
      const uniqueUsers = new Set(recommendations.map(r => r.user_id)).size;

      // Top scholarships
      const scholarshipCounts = recommendations.reduce((acc: any, rec) => {
        acc[rec.bourse_id] = (acc[rec.bourse_id] || 0) + 1;
        return acc;
      }, {});

      const topScholarshipIds = Object.entries(scholarshipCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      // Fetch scholarship titles
      const { data: scholarships } = await supabase
        .from('bourse')
        .select('id, titre')
        .in('id', topScholarshipIds);

      const topScholarships = topScholarshipIds.map(id => ({
        id,
        titre: scholarships?.find(s => s.id === id)?.titre || 'Inconnu',
        count: scholarshipCounts[id]
      }));

      // Score distribution
      const scoreDistribution = [
        { range: '0-0.2', count: 0 },
        { range: '0.2-0.4', count: 0 },
        { range: '0.4-0.6', count: 0 },
        { range: '0.6-0.8', count: 0 },
        { range: '0.8-1.0', count: 0 }
      ];

      recommendations.forEach(rec => {
        const score = Number(rec.score);
        if (score < 0.2) scoreDistribution[0].count++;
        else if (score < 0.4) scoreDistribution[1].count++;
        else if (score < 0.6) scoreDistribution[2].count++;
        else if (score < 0.8) scoreDistribution[3].count++;
        else scoreDistribution[4].count++;
      });

      setStats({
        totalRecommendations,
        averageScore,
        uniqueUsers,
        topScholarships,
        scoreDistribution
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      toast.error('Erreur lors du chargement des statistiques');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleScrapeAll = async () => {
    setIsScrapingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-scholarships', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || "Erreur lors du scraping");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du scraping");
    } finally {
      setIsScrapingAll(false);
    }
  };

  const handleScrapeCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl || !customName) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsScrapingCustom(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-scholarships', {
        body: {
          sourceUrl: customUrl,
          sourceName: customName
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setCustomUrl("");
        setCustomName("");
      } else {
        toast.error(data.error || "Erreur lors du scraping");
      }
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du scraping");
    } finally {
      setIsScrapingCustom(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Panneau d'Administration</h1>
            <p className="text-muted-foreground">Gérez les bourses, utilisateurs et le scraping automatique</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Scraping automatique */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Scraping Automatique
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Importer automatiquement les bourses depuis les sources configurées:
                </p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Campus France</li>
                  <li>• DAAD Germany</li>
                  <li>• Study UK</li>
                  <li>• Scholars4Dev</li>
                  <li>• ScholarshipPortal</li>
                </ul>
                <Button 
                  onClick={handleScrapeAll}
                  disabled={isScrapingAll}
                  className="w-full"
                >
                  {isScrapingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isScrapingAll ? "Scraping en cours..." : "Lancer le Scraping"}
                </Button>
              </CardContent>
            </Card>

            {/* Scraping personnalisé */}
            <Card>
              <CardHeader>
                <CardTitle>Scraping Personnalisé</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleScrapeCustom} className="space-y-4">
                  <div>
                    <Label htmlFor="source-name">Nom de la source</Label>
                    <Input
                      id="source-name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Ex: Bourses UNESCO"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="source-url">URL</Label>
                    <Input
                      id="source-url"
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://example.com/scholarships"
                      required
                    />
                  </div>
                  <Button 
                    type="submit"
                    disabled={isScrapingCustom}
                    className="w-full"
                  >
                    {isScrapingCustom && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isScrapingCustom ? "Scraping..." : "Scraper cette source"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="md:col-span-2">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Les bourses scrapées seront automatiquement ajoutées à la base de données et nécessiteront une approbation manuelle avant d'être visibles par les utilisateurs.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Statistiques des recommandations */}
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">Statistiques des Recommandations</h2>
              <p className="text-muted-foreground">Analyse des performances de l'algorithme de recommandation</p>
            </div>

            {loadingStats ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                </CardContent>
              </Card>
            ) : stats ? (
              <>
                {/* KPIs */}
                <div className="grid md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Recommandations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        <span className="text-3xl font-bold">{stats.totalRecommendations}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Score Moyen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="text-3xl font-bold">{stats.averageScore.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(stats.averageScore * 100).toFixed(0)}% de matching
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Utilisateurs Actifs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <span className="text-3xl font-bold">{stats.uniqueUsers}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Moyenne: {(stats.totalRecommendations / stats.uniqueUsers).toFixed(1)} recommandations/utilisateur
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Score Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Distribution des Scores
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.scoreDistribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Top Scholarships */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Bourses Recommandées</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {stats.topScholarships.map((scholarship, index) => (
                          <div key={scholarship.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                                {index + 1}
                              </div>
                              <span className="text-sm font-medium line-clamp-1">{scholarship.titre}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{scholarship.count} fois</span>
                          </div>
                        ))}
                        {stats.topScholarships.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucune donnée disponible
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground py-8">
                    Aucune statistique disponible
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}