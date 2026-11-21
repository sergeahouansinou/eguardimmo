<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Reporting\Support\OverviewSections;
use Illuminate\Support\Facades\DB;

/**
 * Accueil de la console : des comptes seulement, lus en SQL dans les tables des autres modules (ADR 0037 § 2, ADR 0005). Une requête par
 * section, quel que soit le volume ; aucun nom, adresse, montant ni identifiant de ligne ne sort.
 */
final class PlatformOverview
{
    private const int JOURS_NOUVEAUTES = 30;

    private const int JOURS_ECHEANCE = 7;

    /**
     * @param  list<string>  $sections
     * @return array<string, array<string, mixed>>
     */
    public function lire(array $sections): array
    {
        $lues = [];

        foreach ($sections as $section) {
            $lues[$section] = match ($section) {
                OverviewSections::ORGANISATIONS => $this->organisations(),
                OverviewSections::COMPTES => $this->comptes(),
                OverviewSections::ABONNEMENTS => $this->abonnements(),
                OverviewSections::SUPPORT => $this->support(),
                OverviewSections::RGPD => $this->rgpd(),
                default => [],
            };
        }

        return $lues;
    }

    /**
     * @return array<string, int>
     */
    private function organisations(): array
    {
        $ligne = DB::table('organizations')->selectRaw(
            "COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN kind = 'agency' THEN 1 ELSE 0 END), 0) AS agencies,
            COALESCE(SUM(CASE WHEN kind = 'individual' THEN 1 ELSE 0 END), 0) AS individuals,
            COALESCE(SUM(CASE WHEN suspended_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS suspended,
            COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS created_30d",
            [$this->il(self::JOURS_NOUVEAUTES)],
        )->first();

        return $this->entiers($ligne, ['total', 'agencies', 'individuals', 'suspended', 'created_30d']);
    }

    /**
     * @return array<string, int>
     */
    private function comptes(): array
    {
        $ligne = DB::table('users')->whereNull('deleted_at')->selectRaw(
            'COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN suspended_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS suspended,
            COALESCE(SUM(CASE WHEN suspended_at IS NOT NULL AND suspension_reviewed_at IS NULL THEN 1 ELSE 0 END), 0) AS suspension_to_review,
            COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS created_30d',
            [$this->il(self::JOURS_NOUVEAUTES)],
        )->first();

        return $this->entiers($ligne, ['total', 'suspended', 'suspension_to_review', 'created_30d']);
    }

    /**
     * @return array<string, mixed>
     */
    private function abonnements(): array
    {
        $parStatut = DB::table('subscriptions')->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        $parPlan = DB::table('subscriptions as s')
            ->join('plan_versions as v', 'v.id', '=', 's.plan_version_id')
            ->join('plans as p', 'p.id', '=', 'v.plan_id')
            ->selectRaw('p.code AS code, COUNT(*) AS total')
            ->groupBy('p.code')
            ->orderBy('p.code')
            ->pluck('total', 'code');
        $essaisProches = DB::table('subscriptions')
            ->where('status', 'trialing')
            ->where('trial_ends_at', '<', $this->dans(self::JOURS_ECHEANCE))
            ->count();

        return [
            'by_status' => $parStatut->map(fn (mixed $total): int => (int) $total)->all(),
            'by_plan' => $parPlan->map(fn (mixed $total): int => (int) $total)->all(),
            'trials_ending_7d' => $essaisProches,
        ];
    }

    /**
     * @return array<string, int>
     */
    private function support(): array
    {
        $ligne = DB::table('support_tickets')->whereIn('status', ['open', 'waiting'])->selectRaw(
            "COUNT(*) AS open_total,
            COALESCE(SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END), 0) AS awaiting_support,
            COALESCE(SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END), 0) AS awaiting_requester,
            COALESCE(SUM(CASE WHEN assignee_user_id IS NULL THEN 1 ELSE 0 END), 0) AS unassigned",
        )->first();

        return $this->entiers($ligne, ['open_total', 'awaiting_support', 'awaiting_requester', 'unassigned']);
    }

    /**
     * @return array<string, int>
     */
    private function rgpd(): array
    {
        $echeance = 'COALESCE(extended_until, due_at)';
        $ligne = DB::table('privacy_requests')->whereIn('status', ['received', 'in_progress'])->selectRaw(
            "COUNT(*) AS open_total,
            COALESCE(SUM(CASE WHEN {$echeance} < ? THEN 1 ELSE 0 END), 0) AS overdue,
            COALESCE(SUM(CASE WHEN {$echeance} >= ? AND {$echeance} < ? THEN 1 ELSE 0 END), 0) AS due_within_7d",
            [$this->il(0), $this->il(0), $this->dans(self::JOURS_ECHEANCE)],
        )->first();

        return $this->entiers($ligne, ['open_total', 'overdue', 'due_within_7d']);
    }

    /**
     * @param  list<string>  $cles
     * @return array<string, int>
     */
    private function entiers(?object $ligne, array $cles): array
    {
        $comptes = [];

        foreach ($cles as $cle) {
            $comptes[$cle] = (int) ($ligne->{$cle} ?? 0);
        }

        return $comptes;
    }

    private function il(int $jours): string
    {
        return now()->subDays($jours)->format('Y-m-d H:i:s.u');
    }

    private function dans(int $jours): string
    {
        return now()->addDays($jours)->format('Y-m-d H:i:s.u');
    }
}
