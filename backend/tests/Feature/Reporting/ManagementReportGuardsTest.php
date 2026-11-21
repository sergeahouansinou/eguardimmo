<?php

declare(strict_types=1);

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Reporting\Models\ManagementReport;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesContext;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
});

it('refuse de publier un compte rendu dont un mois n\'est pas clos et ne consomme aucun numéro', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
    $id = R::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);

    R::publier($this, $id)->assertStatus(409)->assertJsonPath('code', 'report_period_not_closed');

    expect(R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id)->status->value))->toBe('generated')
        ->and(R::dans($this->org, fn () => DB::table('management_report_sequences')->count()))->toBe(0);
});

it('refuse une période non terminée, mal formée ou sans mandat', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    R::creer($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31'])->assertStatus(422)->assertJsonPath('code', 'report_period_invalid');
    R::creer($this, ['period_start' => '2026-11-02', 'period_end' => '2026-11-30'])->assertStatus(422)->assertJsonPath('code', 'report_period_invalid');
    R::creer($this, ['period_start' => '2024-01-01', 'period_end' => '2024-01-31'])->assertStatus(422)->assertJsonPath('data.0.error.code', 'report_period_invalid');
});

it('un seul compte rendu vivant par période et par mandant ; un abandon libère la période', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $id = R::rapport($this);

    R::creer($this)->assertStatus(409)->assertJsonPath('data.0.error.code', 'report_period_overlap');
    R::creer($this, ['period_kind' => 'custom', 'period_start' => '2026-10-15', 'period_end' => '2026-11-15'])->assertStatus(409)->assertJsonPath('data.0.error.code', 'report_period_overlap');

    $this->postJson(R::url($this->org, "/management-reports/{$id}/discard"))->assertOk()->assertJsonPath('data.status', 'discarded');
    $this->postJson(R::url($this->org, "/management-reports/{$id}/generate"))->assertStatus(409)->assertJsonPath('code', 'report_not_editable');
    R::creer($this)->assertCreated();
});

it('rejoue une création avec la même clé et refuse la même clé pour un autre contenu', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);

    $premier = R::creer($this, [], 'cle-creation-1')->assertCreated();
    $rejeu = R::creer($this, [], 'cle-creation-1')->assertOk();
    expect($rejeu->json('data.0.outcome'))->toBe('replayed')->and($rejeu->json('data.0.report.id'))->toBe($premier->json('data.0.report.id'));

    R::creer($this, ['options' => ['letterhead' => false]], 'cle-creation-1')->assertStatus(409)->assertJsonPath('data.0.error.code', 'report_idempotency_key_reused');
    expect(R::dans($this->org, fn () => ManagementReport::query()->count()))->toBe(1);

    $this->postJson(R::url($this->org, '/management-reports'), ['period_kind' => 'monthly', 'period_start' => '2026-11-01', 'period_end' => '2026-11-30', 'mandant_ids' => [$this->mandant->id]])
        ->assertStatus(422)->assertJsonPath('code', 'report_idempotency_key_required');
});

it('un mandant d\'une autre organisation est refusé par mandant, sans effet sur les autres', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $autre = C::organisation(nom: 'Autre agence');
    $etranger = L::dans($autre, fn () => MandatesContext::partie($autre));

    $reponse = R::creer($this, ['mandant_ids' => [$etranger->id, $this->mandant->id]])->assertCreated();

    expect($reponse->json('data.0.outcome'))->toBe('failed')->and($reponse->json('data.0.error.code'))->toBe('report_mandant_not_found')
        ->and($reponse->json('data.1.outcome'))->toBe('created');
});

it('le verrou optimiste refuse une modification sur une version périmée', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $id = R::rapport($this);
    $version = $this->getJson(R::url($this->org, "/management-reports/{$id}"))->json('data.lock_version');

    $this->patchJson(R::url($this->org, "/management-reports/{$id}"), ['lock_version' => $version, 'sections' => ['rent', 'payout']])->assertOk()->assertJsonPath('data.lock_version', $version + 1)->assertJsonPath('data.sections', ['rent', 'payout']);
    $this->patchJson(R::url($this->org, "/management-reports/{$id}"), ['lock_version' => $version, 'notify' => false])->assertStatus(409)->assertJsonPath('code', 'report_stale_version');
});

it('un échec de Gotenberg renvoie 503 sans écrire : ni numéro, ni pièce, ni publication', function (): void {
    R::parcours($this);
    $id = R::rapport($this);
    C::$panneGotenberg = true;

    $r = R::publier($this, $id)->assertStatus(503)->assertJsonPath('code', 'report_pdf_unavailable');
    expect($r->headers->get('Retry-After'))->toBe('30')
        ->and(R::dans($this->org, fn () => ManagementReport::query()->findOrFail($id)->status->value))->toBe('generated')
        ->and(R::dans($this->org, fn () => DB::table('management_report_sequences')->count()))->toBe(0)
        ->and(R::dans($this->org, fn () => DB::table('issued_documents')->where('type', 'management_report')->count()))->toBe(0);

    $this->get(R::url($this->org, "/management-reports/{$id}/pdf"))->assertStatus(503);

    C::$panneGotenberg = false;
    R::publier($this, $id)->assertOk()->assertJsonPath('data.number', 'CR-2027-0001');
});

it('un brouillon sans chiffres ne se publie ni ne se télécharge', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $id = R::rapport($this, ['mode' => 'draft']);

    R::publier($this, $id)->assertStatus(409)->assertJsonPath('code', 'report_not_generated');
    $this->get(R::url($this->org, "/management-reports/{$id}/pdf"))->assertStatus(409)->assertJsonPath('code', 'report_not_generated');
    $this->postJson(R::url($this->org, "/management-reports/{$id}/generate"))->assertOk()->assertJsonPath('data.status', 'generated');
});

it('un compte rendu d\'une autre organisation est introuvable', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $id = R::rapport($this);
    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));

    foreach (['GET' => "/management-reports/{$id}", 'POST' => "/management-reports/{$id}/publish", 'GET ' => "/management-reports/{$id}/pdf"] as $verbe => $chemin) {
        $this->json(trim($verbe), R::url($autre, $chemin))->assertNotFound()->assertJsonPath('code', 'report_not_found');
    }

    $this->getJson(R::url($autre, '/management-reports'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(R::url($autre, "/mandants/{$this->mandant->id}/statement?from=2026-11-01&to=2026-11-30"))->assertNotFound()->assertJsonPath('code', 'report_mandant_not_found');
});

it('une organisation sans identité légale ne génère pas de compte rendu', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    L::dans($this->org, fn () => DB::table('organization_legal_identities')->where('organization_id', $this->org->id)->delete());

    R::creer($this)->assertStatus(422)->assertJsonPath('data.0.error.code', 'report_issuer_incomplete');
});

it('seuls ceux qui publient planifient ; la planification s\'annule, exige un compte rendu généré et une date future', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $id = R::rapport($this);
    $brouillon = R::rapport($this, ['mode' => 'draft', 'period_kind' => 'custom', 'period_start' => '2026-09-01', 'period_end' => '2026-10-31']);

    $this->postJson(R::url($this->org, "/management-reports/{$id}/publish"), ['scheduled_for' => '2020-01-01T00:00:00+00:00'])->assertUnprocessable();
    $this->postJson(R::url($this->org, "/management-reports/{$brouillon}/publish"), ['scheduled_for' => '2027-01-11T10:00:00+00:00'])->assertStatus(409)->assertJsonPath('code', 'report_not_generated');

    $this->postJson(R::url($this->org, "/management-reports/{$id}/publish"), ['scheduled_for' => '2026-12-20T10:00:00+00:00'])->assertOk()->assertJsonPath('data.scheduled_for', '2026-12-20T10:00:00+00:00');
    $this->deleteJson(R::url($this->org, "/management-reports/{$id}/schedule"))->assertOk()->assertJsonPath('data.scheduled_for', null);
    expect(R::dans($this->org, fn () => AuditLog::query()->whereIn('action', ['reporting.report.scheduled', 'reporting.report.unscheduled'])->count()))->toBe(2);
});

it('refuse de publier quand le grand livre a bougé depuis la génération, même si la période est close', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
    $id = R::rapport($this, ['period_start' => '2026-12-01', 'period_end' => '2026-12-31']);

    L::dans($this->org, fn () => app(Ledger::class)->post(new EntryData(
        Journal::Bank, CarbonImmutable::parse('2026-12-15'), 'Apport tardif', SourceType::TrustTransfer, (string) Str::uuid7(), 'tardif-'.Str::random(6),
        [LineData::debit(AccountRole::TrustBank, Money\Money::EUR(100)), LineData::credit(AccountRole::OwnerPayable, Money\Money::EUR(100), null, $this->mandant->id)],
    )));
    F::envoyer($this, 'POST', "/api/v1/org/{$this->org->id}/accounting/periods/close", ['month' => '2026-12'])->assertSuccessful();

    R::publier($this, $id)->assertStatus(409)->assertJsonPath('code', 'report_stale_version');
    $this->postJson(R::url($this->org, "/management-reports/{$id}/generate"))->assertOk()->assertJsonPath('data.totals.closing_balance.amount', 70100);
    R::publier($this, $id)->assertOk()->assertJsonPath('data.number', 'CR-2027-0001');
});
