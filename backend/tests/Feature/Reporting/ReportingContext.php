<?php

declare(strict_types=1);

namespace Tests\Feature\Reporting;

use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Parties\Models\Party;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

final class ReportingContext
{
    /**
     * @return array{org: Organization, bail: Lease, mandant: Party}
     */
    public static function agence(object $test): array
    {
        $contexte = F::agence($test);
        config(['reporting.gotenberg.url' => 'http://gotenberg.test']);

        return $contexte;
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/reporting{$chemin}";
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function creer(object $test, array $surcharges = [], ?string $cle = null): TestResponse
    {
        return $test->json('POST', self::url($test->org, '/management-reports'), [
            'period_kind' => 'monthly',
            'period_start' => '2026-11-01',
            'period_end' => '2026-11-30',
            'mandant_ids' => [$test->mandant->id],
            ...$surcharges,
        ], ['Idempotency-Key' => $cle ?? 'cle-'.bin2hex(random_bytes(8))]);
    }

    public static function rapport(object $test, array $surcharges = []): string
    {
        return self::creer($test, $surcharges)->assertCreated()->json('data.0.report.id');
    }

    public static function publier(object $test, string $id): TestResponse
    {
        return $test->postJson(self::url($test->org, "/management-reports/{$id}/publish"));
    }

    /**
     * Compte rendu généré dont la publication est planifiée au 11 janvier 2027.
     *
     * @param  array<string, mixed>  $surcharges
     */
    public static function planifie(object $test, array $surcharges = []): string
    {
        $id = self::rapport($test, $surcharges);
        $test->postJson(self::url($test->org, "/management-reports/{$id}/publish"), ['scheduled_for' => '2027-01-11T10:00:00+00:00'])->assertOk()->assertJsonPath('data.status', 'generated');

        return $id;
    }

    public static function cloreDecembre(object $test): void
    {
        $test->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
        F::envoyer($test, 'POST', "/api/v1/org/{$test->org->id}/accounting/periods/close", ['month' => '2026-12'])->assertSuccessful();
    }

    /**
     * Loyer encaissé, novembre clos, reversement validé et exécuté, puis décembre clos au 10 janvier 2027.
     */
    public static function parcours(object $test): void
    {
        F::encaisserEtCloturer($test, $test->org, $test->bail);
        $lot = F::lotValide($test);
        $test->actingAs(F::comptable($test->org));
        F::executer($test, $lot)->assertOk();
        $test->actingAs(L::titulaire($test->org));
        self::cloreDecembre($test);
    }

    public static function dans(Organization $org, callable $f): mixed
    {
        return L::dans($org, $f);
    }
}
