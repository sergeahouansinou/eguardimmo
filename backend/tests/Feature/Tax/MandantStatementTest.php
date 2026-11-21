<?php

declare(strict_types=1);

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\Party;
use App\Modules\Properties\Models\Property;
use App\Modules\Tax\Events\TaxStatementPublished;
use App\Modules\Tax\Models\TaxSummary;
use App\Shared\Audit\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Owner\OwnerContext as O;
use Tests\Feature\Owner\OwnerReportingContext as RO;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Reporting\ReportingContext as R;
use Tests\Feature\Tax\RulesAnnee2026;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'mandant' => $this->mandant] = R::agence($this);
    config(['tax.gotenberg.url' => 'http://gotenberg.test', 'tax.gotenberg.timeout' => 10]);
    RulesAnnee2026::installer();
});

function relever(object $test, ?string $mandant = null, string $cle = 'cle-releves-001', int $annee = 2026): TestResponse
{
    return $test->postJson(T::url($test->org, '/mandant-statements'), ['income_year' => $annee, 'mandant_ids' => [$mandant ?? $test->mandant->id]], ['Idempotency-Key' => $cle]);
}

function lignesTotales(array $detail): array
{
    return collect($detail['income']['totals'])->keyBy('code')->map(fn (array $l): int => $l['rounded']['amount'])->all();
}

it('génère le relevé du mandant : loyer part OwnerRentCalled, honoraires TTC, forfait 222, prêts à compléter, tout calculé à la main', function (): void {
    R::parcours($this);

    $reponse = relever($this)->assertCreated()
        ->assertJsonPath('data.0.outcome', 'created')
        ->assertJsonPath('data.0.statement.status', 'final')
        ->assertJsonPath('data.0.statement.scope', 'mandant')
        ->assertJsonPath('data.0.statement.mandant_party_id', $this->mandant->id)
        ->assertJsonPath('data.0.error', null);

    $detail = $this->getJson(T::url($this->org, '/mandant-statements/'.$reponse->json('data.0.statement.id')))->assertOk()->json('data');
    $totaux = lignesTotales($detail);
    $statuts = collect($detail['income']['totals'])->pluck('status', 'code')->all();

    expect($detail['income']['provisional'])->toBeFalse()
        ->and($totaux['211'])->toBe(65000)
        ->and($totaux['221'])->toBe(5900)
        ->and($totaux['222'])->toBe(2000)
        ->and($totaux['215'])->toBe(65000)
        ->and($totaux['240'])->toBe(7900)
        ->and($totaux['250'])->toBe(0)
        ->and($totaux['263'])->toBe(65000 - 7900)
        ->and(collect($detail['income']['totals'])->firstWhere('code', '221')['exact']['amount'])->toBe(5880)
        ->and($statuts['250'])->toBe('to_complete')
        ->and($detail['income']['deficit'])->toBeNull()
        ->and($detail['income']['properties'])->toHaveCount(1);
});

it('rejoue sans doublon, refuse la clé réutilisée pour une autre demande et un relevé vivant (409 par mandant)', function (): void {
    R::parcours($this);

    $id = relever($this)->assertCreated()->json('data.0.statement.id');
    relever($this)->assertOk()->assertJsonPath('data.0.outcome', 'replayed')->assertJsonPath('data.0.statement.id', $id);
    relever($this, null, 'cle-releves-002')->assertStatus(409)->assertJsonPath('data.0.outcome', 'failed')->assertJsonPath('data.0.error.code', 'tax_summary_exists');
    relever($this, null, 'cle-releves-001', 2025)->assertStatus(409)->assertJsonPath('data.0.error.code', 'tax_idempotency_key_reused');
    expect(TaxSummary::query()->count())->toBe(1);
});

it('refuse toute la demande avant la fin de l\'année (409), sans Idempotency-Key (422), au-delà de 10 mandants (422 tax_batch_too_large) et un champ calculé (422)', function (): void {
    relever($this)->assertStatus(409)->assertJsonPath('code', 'tax_period_not_closed');

    R::parcours($this);
    $this->postJson(T::url($this->org, '/mandant-statements'), ['income_year' => 2026, 'mandant_ids' => [$this->mandant->id]])->assertStatus(422)->assertJsonPath('code', 'tax_idempotency_key_required');
    $ids = array_map(fn (): string => (string) Str::uuid7(), range(1, 11));
    $this->postJson(T::url($this->org, '/mandant-statements'), ['income_year' => 2026, 'mandant_ids' => $ids], ['Idempotency-Key' => 'cle-releves-051'])->assertStatus(422)->assertJsonPath('code', 'tax_batch_too_large');
    $this->postJson(T::url($this->org, '/mandant-statements'), ['income_year' => 2026, 'mandant_ids' => array_slice($ids, 0, 10)], ['Idempotency-Key' => 'cle-releves-050'])->assertStatus(404)->assertJsonCount(10, 'data');
    $this->postJson(T::url($this->org, '/mandant-statements'), ['income_year' => 2026, 'mandant_ids' => [$this->mandant->id], 'amount' => 5], ['Idempotency-Key' => 'cle-releves-052'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
    expect(TaxSummary::query()->count())->toBe(0);
});

it('budget de temps épuisé : le premier mandant est traité, les suivants reviennent en 503 tax_batch_time_exceeded et se rejouent avec la même clé', function (): void {
    R::parcours($this);
    $autre = C::organisation(OrganizationKind::Agency, 'Autre agence');
    $etranger = L::dans($autre, fn () => Party::factory()->create());
    T::comme($this, L::titulaire($this->org));
    config(['tax.statements_time_budget_seconds' => 0]);
    $corps = ['income_year' => 2026, 'mandant_ids' => [$this->mandant->id, $etranger->id]];

    $this->postJson(T::url($this->org, '/mandant-statements'), $corps, ['Idempotency-Key' => 'cle-budget-001'])->assertCreated()
        ->assertJsonPath('data.0.outcome', 'created')->assertJsonPath('data.1.outcome', 'failed')
        ->assertJsonPath('data.1.error.code', 'tax_batch_time_exceeded')->assertJsonPath('data.1.error.status', 503);

    config(['tax.statements_time_budget_seconds' => 90]);
    $this->postJson(T::url($this->org, '/mandant-statements'), $corps, ['Idempotency-Key' => 'cle-budget-001'])->assertOk()
        ->assertJsonPath('data.0.outcome', 'replayed')->assertJsonPath('data.1.error.code', 'tax_mandant_not_found');
    expect(TaxSummary::query()->count())->toBe(1);
});

it('un mandant inconnu ou d\'une autre agence échoue seul (404 tax_mandant_not_found) ; l\'autre mandant est traité', function (): void {
    R::parcours($this);
    $autre = C::organisation(OrganizationKind::Agency, 'Autre agence');
    $etranger = L::dans($autre, fn () => Party::factory()->create());
    T::comme($this, L::titulaire($this->org));

    $reponse = $this->postJson(T::url($this->org, '/mandant-statements'), ['income_year' => 2026, 'mandant_ids' => [$etranger->id, $this->mandant->id]], ['Idempotency-Key' => 'cle-releves-ex'])->assertCreated();

    expect($reponse->json('data.0.outcome'))->toBe('failed')
        ->and($reponse->json('data.0.error.code'))->toBe('tax_mandant_not_found')
        ->and($reponse->json('data.0.error.status'))->toBe(404)
        ->and($reponse->json('data.1.outcome'))->toBe('created');
});

it('un mandant société est refusé (tax_taxpayer_unsupported), sans rien écrire', function (): void {
    R::parcours($this);
    L::dans($this->org, fn () => Party::query()->whereKey($this->mandant->id)->update(['kind' => PartyKind::Company->value]));

    relever($this)->assertStatus(422)->assertJsonPath('data.0.error.code', 'tax_taxpayer_unsupported');
    expect(TaxSummary::query()->count())->toBe(0);
});

it('fonds des mandants non activés ou activés en cours d\'année : 409 tax_owner_funds_not_ready par mandant', function (): void {
    $scene = F::agence($this, false);
    $this->org = $scene['org'];
    $this->mandant = $scene['mandant'];
    T::comme($this, L::titulaire($this->org));
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));

    relever($this)->assertStatus(409)->assertJsonPath('data.0.error.code', 'tax_owner_funds_not_ready');

    L::dans($this->org, fn () => app(Ledger::class)->activateOwnerFunds(CarbonImmutable::parse('2026-06-01')));
    relever($this, null, 'cle-releves-009')->assertStatus(409)->assertJsonPath('data.0.error.code', 'tax_owner_funds_not_ready');
    expect(TaxSummary::query()->count())->toBe(0);
});

it('403 par rôle : le gestionnaire lit et publie sans générer, le comptable génère et exporte sans publier', function (): void {
    R::parcours($this);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');

    T::comme($this, T::membre($this->org, MemberRole::Manager));
    $this->getJson(T::url($this->org, '/mandant-statements'))->assertOk();
    relever($this, null, 'cle-releves-m01')->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    T::comme($this, T::membre($this->org, MemberRole::Accountant));
    $this->getJson(T::url($this->org, "/mandant-statements/{$id}"))->assertOk();
    $this->postJson(T::url($this->org, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertForbidden()->assertJsonPath('code', 'role_forbidden');
});

it('une organisation individuelle est refusée sur les routes des mandants (403 tax_agency_only)', function (): void {
    $solo = C::organisation(OrganizationKind::Individual);
    T::comme($this, L::titulaire($solo));

    $this->getJson(T::url($solo, '/mandant-statements'))->assertForbidden()->assertJsonPath('code', 'tax_agency_only');
});

it('publication refusée avant la clôture de décembre (409), puis acceptée ; rejeu sans doublon ni seconde notification', function (): void {
    F::encaisserEtCloturer($this, $this->org, $this->bail);
    T::comme($this, L::titulaire($this->org));
    $this->travelTo(CarbonImmutable::parse('2027-01-10 10:00:00'));
    $id = relever($this)->assertCreated()->json('data.0.statement.id');
    $url = T::url($this->org, "/mandant-statements/{$id}/publish");

    $this->postJson($url, ['lock_version' => 1])->assertStatus(409)->assertJsonPath('code', 'tax_period_not_closed');
    expect(TaxSummary::query()->findOrFail($id)->status->value)->toBe('final');

    F::envoyer($this, 'POST', "/api/v1/org/{$this->org->id}/accounting/periods/close", ['month' => '2026-12'])->assertSuccessful();
    Event::fake([TaxStatementPublished::class]);

    $this->postJson($url, ['lock_version' => 9])->assertStatus(409)->assertJsonPath('code', 'tax_summary_stale_version');
    $this->postJson($url, ['lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('data.lock_version', 2);
    $this->postJson($url, ['lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'published');

    Event::assertDispatchedTimes(TaxStatementPublished::class, 1);
    expect(L::dans($this->org, fn () => AuditLog::query()->where('action', 'tax.summary.published')->count()))->toBe(1);
});

it('espace mandant : seul le relevé publié est lisible, minimisé, sans identifiant de pièce, d\'un autre mandant ni d\'une autre agence', function (): void {
    R::parcours($this);
    $moi = RO::rattacher($this->org, $this->mandant);
    $autreMandant = O::proprietaire($this->org, 'bob@exemple.fr');
    $id = relever($this)->assertCreated()->json('data.0.statement.id');

    O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(0, 'data');
    O::comme($this, $moi)->getJson("/api/v1/owner/tax-statements/{$id}")->assertNotFound()->assertJsonPath('code', 'tax_summary_not_found');

    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertOk();

    $liste = O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(1, 'data');
    $liste->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.income_year', 2026)->assertJsonPath('data.0.agency.id', $this->org->id)->assertJsonPath('data.0.totals.0.code', '215')->assertJsonPath('data.0.totals.0.amount.amount', 65000);
    expect(array_keys($liste->json('data.0')))->not->toContain('mandant_party_id')->not->toContain('fingerprint')->not->toContain('idempotency_key');

    $detail = O::comme($this, $moi)->getJson("/api/v1/owner/tax-statements/{$id}")->assertOk();
    expect(json_encode($detail->json()))->not->toContain('mandant_party_id')->not->toContain('idempotency')->not->toContain('request_hash');
    expect(collect($detail->json('data.income.properties.0.lines'))->flatMap(fn (array $l): array => $l['sources'])->pluck('ref')->filter()->all())->toBe([]);
    expect($detail->json('data.income.properties.0.property_id'))->toBeNull()
        ->and(collect($detail->json('data.income.warnings'))->pluck('property_id')->filter()->all())->toBe([])
        ->and(T::comme($this, L::titulaire($this->org))->getJson(T::url($this->org, "/mandant-statements/{$id}"))->json('data.income.properties.0.property_id'))->not->toBeNull();

    O::comme($this, $autreMandant['user'])->getJson("/api/v1/owner/tax-statements/{$id}")->assertNotFound();
    O::comme($this, $autreMandant['user'])->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(0, 'data');
    O::comme($this, $autreMandant['user'])->getJson("/api/v1/owner/tax-statements/{$id}/pdf")->assertNotFound();

    $pdf = O::comme($this, $moi)->get("/api/v1/owner/tax-statements/{$id}/pdf")->assertOk();
    expect($pdf->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');
    O::comme($this, null)->flushHeaders();
    auth()->forgetGuards();
    $this->getJson('/api/v1/owner/tax-statements')->assertUnauthorized();
});

it('grâce de 12 mois en lecture après la fin du mandat : lisible la veille de l\'échéance, introuvable le jour même', function (): void {
    R::parcours($this);
    $moi = RO::rattacher($this->org, $this->mandant);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');
    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertOk();
    L::dans($this->org, fn () => Mandate::query()->where('mandant_party_id', $this->mandant->id)->update(['status' => MandateStatus::Terminated->value, 'ends_on' => '2026-12-31']));

    $this->travelTo(CarbonImmutable::parse('2027-12-30 08:00:00'));
    O::comme($this, $moi)->getJson("/api/v1/owner/tax-statements/{$id}")->assertOk();

    $this->travelTo(CarbonImmutable::parse('2027-12-31 08:00:00'));
    O::comme($this, $moi)->getJson("/api/v1/owner/tax-statements/{$id}")->assertNotFound();
    O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(0, 'data');
});

it('espace mandant : le jeton opérateur d\'un mandant est refusé (operator_token_forbidden)', function (): void {
    R::parcours($this);
    $moi = RO::rattacher($this->org, $this->mandant);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');
    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertOk();
    $jeton = X::jetonOperateur($moi);
    X::changer();

    foreach (['/api/v1/owner/tax-statements', "/api/v1/owner/tax-statements/{$id}", "/api/v1/owner/tax-statements/{$id}/pdf"] as $chemin) {
        $this->withToken($jeton)->getJson($chemin)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
    }
});

it('rectificatif : l\'original publié reste lisible jusqu\'à la publication du rectificatif, qui le remplace ; version obsolète 409', function (): void {
    R::parcours($this);
    $moi = RO::rattacher($this->org, $this->mandant);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');
    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertOk();
    $url = T::url($this->org, "/mandant-statements/{$id}/rectify");

    $this->postJson($url, ['reason' => 'Ajo', 'lock_version' => 2], ['Idempotency-Key' => 'cle-rect-m001'])->assertStatus(422);
    $this->postJson($url, ['reason' => 'Correction des honoraires', 'lock_version' => 1], ['Idempotency-Key' => 'cle-rect-m001'])->assertStatus(409)->assertJsonPath('code', 'tax_summary_stale_version');
    $nouveau = $this->postJson($url, ['reason' => 'Correction des honoraires', 'lock_version' => 2], ['Idempotency-Key' => 'cle-rect-m002'])->assertCreated()->assertJsonPath('data.supersedes_id', $id)->assertJsonPath('data.status', 'final')->json('data.id');
    $this->postJson($url, ['reason' => 'Correction des honoraires', 'lock_version' => 2], ['Idempotency-Key' => 'cle-rect-m003'])->assertStatus(409)->assertJsonPath('code', 'tax_summary_exists');

    O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.status', 'published');
    O::comme($this, $moi)->getJson("/api/v1/owner/tax-statements/{$nouveau}")->assertNotFound();

    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$nouveau}/publish"), ['lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'published');

    $liste = O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(2, 'data');
    expect(collect($liste->json('data'))->pluck('status', 'id')->all())->toBe([$nouveau => 'published', $id => 'superseded']);
    expect(L::dans($this->org, fn () => TaxSummary::query()->where('status', 'published')->count()))->toBe(1);
});

it('rectificatif en chaîne : un rectificatif périmé se refait sans bloquer la publication, l\'original reste lisible jusque-là', function (): void {
    R::parcours($this);
    $moi = RO::rattacher($this->org, $this->mandant);
    $original = relever($this)->assertCreated()->json('data.0.statement.id');
    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$original}/publish"), ['lock_version' => 1])->assertOk();

    $r1 = $this->postJson(T::url($this->org, "/mandant-statements/{$original}/rectify"), ['reason' => 'Premier rectificatif', 'lock_version' => 2], ['Idempotency-Key' => 'cle-chaine-001'])->assertCreated()->json('data.id');
    L::dans($this->org, fn () => Property::query()->update(['name' => 'Bien renommé après le calcul']));

    $this->postJson(T::url($this->org, "/mandant-statements/{$r1}/publish"), ['lock_version' => 1])->assertStatus(409)->assertJsonPath('code', 'tax_summary_stale_version');

    $r2 = $this->postJson(T::url($this->org, "/mandant-statements/{$r1}/rectify"), ['reason' => 'Second rectificatif', 'lock_version' => 1], ['Idempotency-Key' => 'cle-chaine-002'])
        ->assertCreated()->assertJsonPath('data.supersedes_id', $original)->json('data.id');

    $this->postJson(T::url($this->org, "/mandant-statements/{$original}/rectify"), ['reason' => 'Rectificatif concurrent', 'lock_version' => 2], ['Idempotency-Key' => 'cle-chaine-003'])->assertStatus(409)->assertJsonPath('code', 'tax_summary_exists');
    O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $original);

    T::comme($this, L::titulaire($this->org));
    $this->postJson(T::url($this->org, "/mandant-statements/{$r2}/publish"), ['lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'published');

    $liste = O::comme($this, $moi)->getJson('/api/v1/owner/tax-statements')->assertOk()->assertJsonCount(2, 'data');
    expect(collect($liste->json('data'))->pluck('status', 'id')->all())->toBe([$r2 => 'published', $original => 'superseded'])
        ->and(L::dans($this->org, fn () => TaxSummary::query()->findOrFail($r1)->status->value))->toBe('superseded')
        ->and(L::dans($this->org, fn () => TaxSummary::query()->where('status', 'published')->count()))->toBe(1);
});

it('IDOR agence : un relevé d\'une autre agence est introuvable en lecture, publication, rectificatif, PDF et CSV', function (): void {
    R::parcours($this);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');

    $autre = C::organisation(OrganizationKind::Agency, 'Autre agence');
    T::comme($this, L::titulaire($autre));

    $this->getJson(T::url($autre, "/mandant-statements/{$id}"))->assertNotFound()->assertJsonPath('code', 'tax_summary_not_found');
    $this->postJson(T::url($autre, "/mandant-statements/{$id}/publish"), ['lock_version' => 1])->assertNotFound();
    $this->postJson(T::url($autre, "/mandant-statements/{$id}/rectify"), ['reason' => 'Tentative de rectification', 'lock_version' => 1], ['Idempotency-Key' => 'cle-idor-m001'])->assertNotFound();
    $this->get(T::url($autre, "/mandant-statements/{$id}/pdf"))->assertNotFound();
    $this->get(T::url($autre, "/mandant-statements/{$id}/lines.csv"))->assertNotFound();
    $this->getJson(T::url($autre, '/mandant-statements'))->assertOk()->assertJsonCount(0, 'data');
});

it('un relevé de mandant n\'est pas lisible par les routes du bailleur autonome, ni l\'inverse', function (): void {
    R::parcours($this);
    $id = relever($this)->assertCreated()->json('data.0.statement.id');

    $this->getJson(T::url($this->org, "/summaries/{$id}"))->assertForbidden()->assertJsonPath('code', 'tax_landlord_only');
});
