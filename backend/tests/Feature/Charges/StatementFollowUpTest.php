<?php

declare(strict_types=1);

use App\Modules\Organizations\Enums\MemberRole;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
});

function pendantes(array $scene): array
{
    return L::dans($scene['org'], fn (): array => array_map(fn (object $l): array => (array) $l, DB::table('rent_adjustments')->where('status', 'pending')->orderBy('source_id')->orderBy('position')->get()->all()));
}

it('rectifie un décompte émis : nouvel exercice limité au bail, effet égal à la différence, ancien décompte superseded', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000, ['recoverable_amount' => 100000, 'total_gross' => 116000]);
    $ancien = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $depense = DB::table('charge_item_sources')->where('exercise_id', $exercice)->value('source_id');

    $rectif = $this->postJson(C::url($scene['org'], "/statements/{$ancien['id']}/rectify"), ['reason' => 'Facture d\'ascenseur corrigée'], ['Idempotency-Key' => 'rectif-0001'])->assertCreated()
        ->assertJsonPath('data.only_lease_id', $ancien['lease_id'])->assertJsonPath('data.status', 'computed')->assertJsonPath('data.statements.0.supersedes_id', $ancien['id']);
    $id = $rectif->json('data.id');
    $this->postJson(C::url($scene['org'], "/statements/{$ancien['id']}/rectify"), ['reason' => 'Facture d\'ascenseur corrigée'], ['Idempotency-Key' => 'rectif-0001'])->assertCreated()->assertJsonPath('data.id', $id);
    $this->postJson(C::url($scene['org'], "/statements/{$ancien['id']}/rectify"), ['reason' => 'Autre'], ['Idempotency-Key' => 'rectif-0002'])->assertStatus(409)->assertJsonPath('code', 'charge_exercise_state_invalid');

    $this->patchJson(C::url($scene['org'], "/exercises/{$id}"), ['lock_version' => $rectif->json('data.lock_version'), 'items' => [E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 90000], ['unit_id' => $scene['unit']->id])]])->assertOk();
    E::calculer($this, $scene, $id)->assertOk()->assertJsonPath('data.statements.0.balance.amount', 85000);
    $nouveau = E::emettre($this, $scene, $id)->assertOk()->assertJsonPath('data.status', 'issued')->json('data.statements.0');

    expect($nouveau['number'])->toBe('DC-2026-0002')->and($nouveau['supersedes_id'])->toBe($ancien['id']);
    $this->getJson(C::url($scene['org'], "/statements/{$ancien['id']}"))->assertOk()->assertJsonPath('data.status', 'superseded');
    $montants = array_map(fn (array $l): int => $l['amount'], pendantes($scene));
    expect($montants)->toHaveCount(2)->and(array_sum($montants))->toBe(85000);
});

it('refuse de rectifier un décompte non émis', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $decompte = $this->getJson(C::url($scene['org'], "/exercises/{$exercice}"))->json('data.statements.0');

    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/rectify"), ['reason' => 'Test'], ['Idempotency-Key' => 'rectif-0001'])->assertStatus(409)->assertJsonPath('code', 'charge_statement_state_invalid');
    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/rectify"), [], ['Idempotency-Key' => 'rectif-0001'])->assertStatus(422);
});

it('étale un solde positif en douze mensualités par accord, l\'écart d\'arrondi sur la dernière', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8126);
    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');

    expect($decompte['balance']['amount'])->toBe(3126);
    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/installment-plan"), ['reason' => 'Demande du locataire', 'basis' => 'agreement'], ['Idempotency-Key' => 'plan-0001'])->assertCreated()
        ->assertJsonPath('data.settlement', 'plan_12')->assertJsonPath('data.plan.reason', 'Demande du locataire');

    $lignes = pendantes($scene);
    expect($lignes)->toHaveCount(12)->and(array_sum(array_column($lignes, 'amount')))->toBe(3126)
        ->and($lignes[0]['amount'])->toBe(260)->and($lignes[11]['amount'])->toBe(266)
        ->and($lignes[0]['not_before'])->toBe('2026-12-16')->and($lignes[11]['not_before'])->toBe('2027-11-16');

    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/installment-plan"), ['reason' => 'Demande du locataire', 'basis' => 'agreement'], ['Idempotency-Key' => 'plan-0001'])->assertCreated();
    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/installment-plan"), ['reason' => 'Encore', 'basis' => 'agreement'], ['Idempotency-Key' => 'plan-0002'])->assertStatus(409)->assertJsonPath('code', 'charge_statement_state_invalid');
    expect(pendantes($scene))->toHaveCount(12);
});

it('le droit aux douzièmes de plein droit suppose un décompte tardif', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $positif = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');

    $this->postJson(C::url($scene['org'], "/statements/{$positif['id']}/installment-plan"), ['reason' => 'Demande', 'basis' => 'late_statement'], ['Idempotency-Key' => 'plan-0001'])->assertStatus(422)->assertJsonPath('code', 'charges_plan_invalid');
    $this->postJson(C::url($scene['org'], "/statements/{$positif['id']}/installment-plan"), ['reason' => 'Demande', 'basis' => 'autre'], ['Idempotency-Key' => 'plan-0002'])->assertStatus(422);
});

it('un crédit ne s\'étale pas', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 3000);
    $credit = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');

    $this->postJson(C::url($scene['org'], "/statements/{$credit['id']}/installment-plan"), ['reason' => 'Demande', 'basis' => 'agreement'], ['Idempotency-Key' => 'plan-0003'])->assertStatus(422)->assertJsonPath('code', 'charges_plan_invalid');
});

it('publie une pièce au locataire pour la durée de mise à disposition, la retire à la demande', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');
    $detail = $this->getJson(C::url($scene['org'], "/statements/{$decompte['id']}"))->assertOk()->assertJsonCount(1, 'data.files');
    $piece = $detail->json('data.files.0');

    expect($piece['tenant_visible'])->toBeFalse()->and($piece['visible_until'])->toBeNull();

    $this->patchJson(C::url($scene['org'], "/statements/{$decompte['id']}/files/{$piece['id']}"), ['tenant_visible' => true])->assertOk()
        ->assertJsonPath('data.files.0.tenant_visible', true)->assertJsonPath('data.files.0.visible_until', '2027-05-16');
    $this->patchJson(C::url($scene['org'], "/statements/{$decompte['id']}/files/{$piece['id']}"), ['tenant_visible' => false])->assertOk()->assertJsonPath('data.files.0.visible_until', null);
    $this->patchJson(C::url($scene['org'], "/statements/{$decompte['id']}/files/01a1f4d0-67ab-727b-b75d-e08917fa3bfa"), ['tenant_visible' => true])->assertStatus(404);
    $this->patchJson(C::url($scene['org'], "/statements/{$decompte['id']}/files/{$piece['id']}"), [])->assertStatus(422);
    expect(DB::table('audit_logs')->whereIn('action', ['charges.file.shared', 'charges.file.unshared'])->count())->toBe(2);
});

it('exporte les décomptes et les dépenses en CSV, cellules préfixées contre les formules, réservé au comptable, à l\'administrateur et au propriétaire', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000, ['payee_label' => '=HYPERLINK("x")']);
    E::emettre($this, $scene, $exercice)->assertOk();

    $csv = $this->get(C::url($scene['org'], "/exercises/{$exercice}/statements.csv"))->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    expect($csv->getContent())->toContain('DC-2026-0001')->and($csv->getContent())->toStartWith("\u{FEFF}\"numero\";");

    $depenses = $this->get(C::url($scene['org'], '/expenses.csv?from=2026-01-01&to=2027-01-01'))->assertOk()->getContent();
    expect($depenses)->toContain('"\'=HYPERLINK(""x"")"')->and($depenses)->not->toContain('"=HYPERLINK');

    $gestionnaire = C::membre($scene['org'], MemberRole::Manager);
    C::comme($this, $gestionnaire);
    $this->get(C::url($scene['org'], "/exercises/{$exercice}/statements.csv"))->assertForbidden();
    C::comme($this, C::membre($scene['org'], MemberRole::Accountant));
    $this->get(C::url($scene['org'], "/exercises/{$exercice}/statements.csv"))->assertOk();
    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/issue"), [], ['Idempotency-Key' => 'emission-0009'])->assertForbidden();
});
