<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Models\TaxSummaryLine;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tax\TaxContext as T;

beforeEach(function (): void {
    T::preparer($this);
    $this->scene = T::bailleur2025($this);
    $this->org = $this->scene['org'];
    T::comme($this, $this->scene['owner']);
});

function cloturer(object $test): void
{
    $test->travelTo(CarbonImmutable::parse('2026-02-01 10:00:00'));
}

function figer(object $test, string $cle = 'cle-figer-0001', int $annee = 2025): TestResponse
{
    return $test->postJson(T::url($test->org, '/summaries'), ['income_year' => $annee], ['Idempotency-Key' => $cle]);
}

it('calcule à la volée : provisoire tant que l\'année n\'est pas terminée, loyers au prorata de l\'appel, rien d\'écrit', function (): void {
    $reponse = $this->getJson(T::url($this->org, '/rental-income/2025'))->assertOk();

    $reponse->assertJsonPath('data.provisional', true)
        ->assertJsonPath('data.income_year', 2025)
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.household_complete', false)
        ->assertJsonPath('data.deficit', null);
    expect($reponse->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

    $totaux = collect($reponse->json('data.totals'))->keyBy('code');
    expect($totaux['211']['rounded']['amount'])->toBe(27900)
        ->and($totaux['211']['exact']['amount'])->toBe(27857)
        ->and($totaux['211']['rounded']['currency'])->toBe('EUR')
        ->and(TaxSummary::query()->count())->toBe(0);

    cloturer($this);
    $this->getJson(T::url($this->org, '/rental-income/2025'))->assertOk()->assertJsonPath('data.provisional', false);
});

it('refuse une année sans formulaire (422) et une année mal formée (404 de route)', function (): void {
    $this->getJson(T::url($this->org, '/rental-income/2024'))->assertStatus(422)->assertJsonPath('code', 'tax_year_unsupported');
    $this->getJson(T::url($this->org, '/rental-income/abcd'))->assertNotFound();
});

it('foyer complet : la simulation du déficit apparaît seulement si le client la demande', function (): void {
    $this->getJson(T::url($this->org, '/rental-income/2025?household_complete=1'))->assertOk()->assertJsonPath('data.household_complete', true);
    $this->getJson(T::url($this->org, '/rental-income/2025?household_complete=oui'))->assertStatus(422);
});

it('401 sans session, 404 hors organisation, jeton opérateur refusé', function (): void {
    $url = T::url($this->org, '/summaries');

    $this->flushHeaders();
    auth()->forgetGuards();
    $this->getJson($url)->assertUnauthorized();

    T::comme($this, T::membre(C::organisation(OrganizationKind::Individual), MemberRole::Owner));
    $this->getJson($url)->assertNotFound()->assertJsonPath('code', 'organization_not_found');

    $jeton = X::jetonOperateur(L::membre($this->org, MemberRole::Admin));
    X::changer();
    $this->withToken($jeton)->getJson($url)->assertForbidden()->assertJsonPath('code', 'operator_token_forbidden');
});

it('403 role_forbidden : le gestionnaire ne prépare ni ne rectifie, l\'expert-comptable lit, prépare et exporte', function (): void {
    cloturer($this);
    T::comme($this, T::membre($this->org, MemberRole::Manager));
    $this->getJson(T::url($this->org, '/summaries'))->assertOk();
    figer($this)->assertForbidden()->assertJsonPath('code', 'role_forbidden');

    T::comme($this, T::membre($this->org, MemberRole::Accountant));
    figer($this)->assertCreated();
});

it('une agence est refusée sur les routes du bailleur autonome (403 tax_landlord_only)', function (): void {
    $agence = C::organisation(OrganizationKind::Agency);
    T::comme($this, L::titulaire($agence));

    $this->getJson(T::url($agence, '/summaries'))->assertForbidden()->assertJsonPath('code', 'tax_landlord_only');
    $this->getJson(T::url($agence, '/rental-income/2025'))->assertForbidden()->assertJsonPath('code', 'tax_landlord_only');
});

it('fige une synthèse : 201, PDF émis, lignes en ajout seul, rejeu 200 sans doublon', function (): void {
    cloturer($this);

    $premiere = figer($this)->assertCreated()
        ->assertJsonPath('data.status', 'final')
        ->assertJsonPath('data.scope', 'organization')
        ->assertJsonPath('data.income_year', 2025)
        ->assertJsonPath('data.lock_version', 1)
        ->assertJsonPath('data.has_pdf', true)
        ->assertJsonPath('data.income.provisional', false);
    $id = $premiere->json('data.id');

    $rejeu = figer($this)->assertOk();
    expect($rejeu->json('data.id'))->toBe($id)
        ->and(TaxSummary::query()->count())->toBe(1)
        ->and(TaxSummaryLine::query()->where('summary_id', $id)->whereNull('property_id')->where('line_code', '211')->value('amount_rounded'))->toBe(27900);

    $this->getJson(T::url($this->org, "/summaries/{$id}"))->assertOk()->assertJsonPath('data.id', $id);
    $this->getJson(T::url($this->org, '/summaries'))->assertOk()->assertJsonPath('data.0.id', $id)
        ->assertJsonPath('data.0.totals.0.code', '215')->assertJsonPath('data.0.totals.0.amount.amount', 27900)->assertJsonPath('data.0.totals.4.code', '263');
    expect(json_encode($premiere->json()))->not->toContain('idempotency')->not->toContain('request_hash')->not->toContain('issued_document');
});

it('refuse de figer avant la fin de l\'année (409), sans Idempotency-Key (422), une clé réutilisée pour autre chose (409), une 2e synthèse vivante (409)', function (): void {
    figer($this)->assertStatus(409)->assertJsonPath('code', 'tax_period_not_closed');

    cloturer($this);
    $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 2025])->assertStatus(422)->assertJsonPath('code', 'tax_idempotency_key_required');
    $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 2025], ['Idempotency-Key' => 'court'])->assertStatus(422);

    figer($this)->assertCreated();
    $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 2025, 'household_complete' => true], ['Idempotency-Key' => 'cle-figer-0001'])
        ->assertStatus(409)->assertJsonPath('code', 'tax_idempotency_key_reused');
    figer($this, 'cle-figer-0002')->assertStatus(409)->assertJsonPath('code', 'tax_summary_exists');
    expect(TaxSummary::query()->count())->toBe(1);
});

it('n\'accepte du client que l\'année et le foyer : montant, statut, devise, portée, mandant et lignes sont interdits', function (): void {
    cloturer($this);

    foreach (['amount' => 1, 'status' => 'published', 'currency' => 'USD', 'scope' => 'mandant', 'mandant_party_id' => (string) Str::uuid7(), 'lines' => [['code' => '211']], 'snapshot' => ['x' => 1]] as $champ => $valeur) {
        $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 2025, $champ => $valeur], ['Idempotency-Key' => 'cle-intrusion-01'])
            ->assertStatus(422)->assertJsonValidationErrors([$champ]);
    }

    $this->postJson(T::url($this->org, '/summaries'), ['income_year' => 1999], ['Idempotency-Key' => 'cle-intrusion-01'])->assertStatus(422);
    expect(TaxSummary::query()->count())->toBe(0);
});

it('une panne du PDF répond 503 sans rien écrire, puis la reprise avec la même clé réussit', function (): void {
    cloturer($this);
    C::$panneGotenberg = true;

    figer($this)->assertStatus(503)->assertJsonPath('code', 'tax_pdf_unavailable');
    expect(TaxSummary::query()->count())->toBe(0)->and(TaxSummaryLine::query()->count())->toBe(0);

    C::$panneGotenberg = false;
    figer($this)->assertCreated();
});

it('rectifie : nouvelle synthèse, original remplacé, version obsolète 409, remplacée non rectifiable 409', function (): void {
    cloturer($this);
    $original = figer($this)->assertCreated()->json('data');
    $url = T::url($this->org, "/summaries/{$original['id']}/rectify");

    $this->postJson($url, ['reason' => 'Ajo', 'lock_version' => 1], ['Idempotency-Key' => 'cle-rect-0001'])->assertStatus(422)->assertJsonValidationErrors(['reason']);
    $this->postJson($url, ['reason' => 'Correction après ajout d\'une dépense', 'lock_version' => 7], ['Idempotency-Key' => 'cle-rect-0001'])
        ->assertStatus(409)->assertJsonPath('code', 'tax_summary_stale_version');

    $nouvelle = $this->postJson($url, ['reason' => 'Correction après ajout d\'une dépense', 'lock_version' => 1], ['Idempotency-Key' => 'cle-rect-0002'])
        ->assertCreated()->assertJsonPath('data.supersedes_id', $original['id'])->assertJsonPath('data.status', 'final')->json('data');

    expect($nouvelle['id'])->not->toBe($original['id']);
    $this->getJson(T::url($this->org, "/summaries/{$original['id']}"))->assertOk()->assertJsonPath('data.status', 'superseded');
    $this->postJson($url, ['reason' => 'Correction après ajout d\'une dépense', 'lock_version' => 2], ['Idempotency-Key' => 'cle-rect-0003'])
        ->assertStatus(409)->assertJsonPath('code', 'tax_summary_not_rectifiable');
    $this->postJson($url, ['reason' => 'Correction après ajout d\'une dépense', 'lock_version' => 1], ['Idempotency-Key' => 'cle-rect-0002'])
        ->assertOk()->assertJsonPath('data.id', $nouvelle['id']);
    expect(TaxSummary::query()->where('status', 'final')->count())->toBe(1);
});

it('IDOR : la synthèse d\'une autre organisation est introuvable (404) sur lecture, rectificatif, PDF et CSV', function (): void {
    cloturer($this);
    $id = figer($this)->assertCreated()->json('data.id');

    $autre = C::organisation(OrganizationKind::Individual, 'Autre bailleur');
    T::comme($this, L::titulaire($autre));

    $this->getJson(T::url($autre, "/summaries/{$id}"))->assertNotFound()->assertJsonPath('code', 'tax_summary_not_found');
    $this->postJson(T::url($autre, "/summaries/{$id}/rectify"), ['reason' => 'Tentative de rectification', 'lock_version' => 1], ['Idempotency-Key' => 'cle-idor-0001'])->assertNotFound();
    $this->getJson(T::url($autre, "/summaries/{$id}/pdf"))->assertNotFound();
    $this->getJson(T::url($autre, "/summaries/{$id}/lines.csv"))->assertNotFound();
    $this->getJson(T::url($autre, '/summaries'))->assertOk()->assertJsonCount(0, 'data');
});

it('le PDF fiscal ne se sert pas par la route générique des documents, seulement par la route Tax', function (): void {
    cloturer($this);
    $id = figer($this)->assertCreated()->json('data.id');
    $fichier = TaxSummary::query()->findOrFail($id)->stored_file_id;

    $this->get("/api/v1/org/{$this->org->id}/documents/files/{$fichier}/download")->assertNotFound()->assertJsonPath('code', 'file_not_found');
    $this->get(T::url($this->org, "/summaries/{$id}/pdf"), ['Accept' => 'application/pdf'])->assertOk();
});

it('PDF et CSV : en-têtes privés, journal d\'audit, montants en unités mineures, texte neutralisé contre les formules', function (): void {
    cloturer($this);
    $id = figer($this)->assertCreated()->json('data.id');

    $pdf = $this->get(T::url($this->org, "/summaries/{$id}/pdf"), ['Accept' => 'application/pdf'])->assertOk();
    expect($pdf->headers->get('Cache-Control'))->toContain('no-store')->toContain('private');

    $csv = $this->get(T::url($this->org, "/summaries/{$id}/lines.csv"))->assertOk();
    $contenu = $csv->getContent();
    expect($csv->headers->get('Content-Type'))->toContain('text/csv')
        ->and($csv->headers->get('Cache-Control'))->toContain('no-store')
        ->and($contenu)->toContain('"total";"211";"computed";27857;27900;"EUR"');

    expect(DB::table('audit_logs')->whereIn('action', ['tax.summary.downloaded', 'tax.summary.exported', 'tax.summary.finalized'])->count())->toBe(3);
});

it('une synthèse figée ne se réécrit pas : UPDATE d\'une colonne figée et DELETE refusés par la base', function (): void {
    cloturer($this);
    $id = figer($this)->assertCreated()->json('data.id');

    expect(fn () => DB::table('tax_summaries')->where('id', $id)->update(['fingerprint' => 'x']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('tax_summaries')->where('id', $id)->delete())->toThrow(QueryException::class)
        ->and(fn () => DB::table('tax_summary_lines')->where('summary_id', $id)->update(['amount_rounded' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('tax_summary_lines')->where('summary_id', $id)->delete())->toThrow(QueryException::class);
});
