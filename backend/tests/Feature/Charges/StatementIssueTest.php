<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Charges\Events\ChargeStatementIssued;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Charges\ChargesContext as C;
use Tests\Feature\Charges\ExercisesContext as E;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as R;

beforeEach(function (): void {
    C::preparer($this);
});

function ajustements(array $scene): array
{
    return L::dans($scene['org'], fn (): array => array_map(fn (object $l): array => (array) $l, DB::table('rent_adjustments')->orderBy('source_id')->orderBy('position')->get()->all()));
}

it('émet le décompte d\'un solde positif : numéro, PDF, pièce, ligne en attente un mois plus tard, journal, événement', function (): void {
    Event::fake([ChargeStatementIssued::class]);
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);

    $reponse = E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.status', 'issued');
    $decompte = $reponse->json('data.statements.0');

    expect($decompte['status'])->toBe('issued')->and($decompte['number'])->toBe('DC-2026-0001')->and($decompte['balance']['amount'])->toBe(3000)
        ->and($decompte['settlement'])->toBe('next_installments')->and($decompte['not_before'])->toBe('2026-12-16');

    $lignes = ajustements($scene);
    expect($lignes)->toHaveCount(1)->and($lignes[0]['source_id'])->toBe($decompte['id'])->and($lignes[0]['amount'])->toBe(3000)->and($lignes[0]['status'])->toBe('pending')->and($lignes[0]['not_before'])->toBe('2026-12-16');

    $piece = L::dans($scene['org'], fn () => DB::table('issued_documents')->where('type', 'charges_regularization')->first());
    expect($piece)->not->toBeNull();
    $actions = DB::table('audit_logs')->where('subject_id', $decompte['id'])->pluck('action')->all();
    expect($actions)->toContain('charges.statement.issued');
    Event::assertDispatched(ChargeStatementIssued::class, fn (ChargeStatementIssued $e): bool => $e->statementId === $decompte['id']);

    $this->get(C::url($scene['org'], "/statements/{$decompte['id']}/pdf"))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect(DB::table('audit_logs')->where('action', 'charges.statement.downloaded')->count())->toBe(1);
});

it('rejoue la même clé sans second effet ; refuse la même clé avec un autre contenu', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);

    E::emettre($this, $scene, $exercice, 'emission-0001')->assertOk();
    E::emettre($this, $scene, $exercice, 'emission-0001')->assertOk()->assertJsonPath('data.statements.0.number', 'DC-2026-0001');
    E::emettre($this, $scene, $exercice, 'emission-0001', ['acknowledge_prescription' => true])->assertStatus(409)->assertJsonPath('code', 'charges_idempotency_key_reused');
    E::emettre($this, $scene, $exercice, 'emission-0002')->assertStatus(409)->assertJsonPath('code', 'charge_exercise_state_invalid');

    expect(ajustements($scene))->toHaveCount(1)->and(L::dans($scene['org'], fn () => DB::table('charge_sequences')->value('last_value')))->toBe(1);
});

it('exige l\'en-tête Idempotency-Key', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);

    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/issue"))->assertStatus(422)->assertJsonPath('code', 'charges_idempotency_key_required');
});

it('un solde négatif crédite l\'avance du bail une seule fois, source charge_statement', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 3000);

    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->json('data.statements.0');

    expect($decompte['balance']['amount'])->toBe(-2000)->and($decompte['settlement'])->toBe('credit')->and(ajustements($scene))->toBe([]);

    $ecritures = L::dans($scene['org'], fn () => DB::table('journal_entries')->where('source_type', 'charge_statement')->where('source_id', $decompte['id'])->get());
    expect($ecritures)->toHaveCount(1)->and(C::net($scene['org'], AccountRole::ChargesRecovered))->toBeLessThan(0);
});

it('un solde nul ne produit aucun effet', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 5000);

    E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.statements.0.settlement', 'none');

    expect(ajustements($scene))->toBe([])
        ->and(L::dans($scene['org'], fn () => DB::table('journal_entries')->where('source_type', 'charge_statement')->count()))->toBe(0);
});

it('une panne Gotenberg ne laisse aucune pièce ni trou de numérotation : le numéro et l\'effet restent attachés au décompte, la reprise ne les rejoue pas', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    R::$panneGotenberg = true;

    $reponse = E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.status', 'issuing');
    $decompte = $reponse->json('data.statements.0');

    expect($decompte['status'])->toBe('failed')->and($decompte['failure_reason'])->toBe('charges_pdf_unavailable')->and($decompte['number'])->toBe('DC-2026-0001')
        ->and(ajustements($scene))->toHaveCount(1)
        ->and(L::dans($scene['org'], fn () => DB::table('charge_sequences')->value('last_value')))->toBe(1)
        ->and(L::dans($scene['org'], fn () => DB::table('issued_documents')->where('type', 'charges_regularization')->count()))->toBe(0)
        ->and(L::dans($scene['org'], fn () => DB::table('charge_statements')->where('id', $decompte['id'])->value('issued_document_id')))->toBeNull();

    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/retry"), [], ['Idempotency-Key' => 'reprise-0001'])->assertStatus(503)->assertJsonPath('code', 'charges_pdf_unavailable');

    R::$panneGotenberg = false;
    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/retry"), [], ['Idempotency-Key' => 'reprise-0002'])->assertOk()->assertJsonPath('data.number', 'DC-2026-0001')->assertJsonPath('data.status', 'issued');
    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/retry"), [], ['Idempotency-Key' => 'reprise-0003'])->assertOk()->assertJsonPath('data.number', 'DC-2026-0001');

    $this->getJson(C::url($scene['org'], "/exercises/{$exercice}"))->assertJsonPath('data.status', 'issued');
    expect(ajustements($scene))->toHaveCount(1)->and(L::dans($scene['org'], fn () => DB::table('charge_sequences')->value('last_value')))->toBe(1)
        ->and(L::dans($scene['org'], fn () => DB::table('issued_documents')->where('type', 'charges_regularization')->count()))->toBe(1);
});

it('le rendu PDF se fait hors de toute transaction, donc hors du verrou de numérotation', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    $niveaux = [];
    Http::swap(new Factory);
    Http::fake(['gotenberg.test/*' => function () use (&$niveaux) {
        $niveaux[] = DB::transactionLevel();

        return Http::response(DocumentsContext::PDF, 200);
    }]);
    $base = DB::transactionLevel();

    E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.status', 'issued');

    expect($niveaux)->toHaveCount(1)->and($niveaux[0])->toBe($base);
});

it('une erreur imprévue pendant l\'émission laisse le décompte en panne et reprenable, jamais l\'exercice bloqué', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    Http::swap(new Factory);
    $appels = 0;
    Http::fake(['gotenberg.test/*' => function () use (&$appels) {
        if (++$appels === 1) {
            throw new RuntimeException('Rendu interrompu');
        }

        return Http::response(DocumentsContext::PDF, 200);
    }]);

    $decompte = E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.status', 'issuing')->json('data.statements.0');

    expect($decompte['status'])->toBe('failed')->and($decompte['number'])->toBe('DC-2026-0001');

    $this->postJson(C::url($scene['org'], "/statements/{$decompte['id']}/retry"), [], ['Idempotency-Key' => 'reprise-0001'])->assertOk()->assertJsonPath('data.number', 'DC-2026-0001');
    $this->getJson(C::url($scene['org'], "/exercises/{$exercice}"))->assertJsonPath('data.status', 'issued');
    expect(ajustements($scene))->toHaveCount(1);
});

it('la panne d\'un bail n\'arrête pas les autres ; numérotation continue', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    $b = E::lot($scene['org'], $scene['property']);
    E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2026-01-01']);
    E::bailSurLot($scene['org'], $b, ['starts_on' => '2026-01-01']);
    C::comme($this, $scene['owner']);
    $cle = E::cle($this, $scene, 'surface')->assertCreated()->json('data.id');
    $exercice = E::exerciceAvecPoste($this, $scene, E::depense($this, $scene), 80000, ['key_id' => $cle]);
    E::calculer($this, $scene, $exercice)->assertOk();
    Http::swap(new Factory);
    Http::fake(['gotenberg.test/*' => Http::sequence()->push(DocumentsContext::PDF, 200)->push('erreur', 500)->push(DocumentsContext::PDF, 200)]);

    $reponse = E::emettre($this, $scene, $exercice)->assertOk()->assertJsonPath('data.status', 'issuing');
    $statuts = collect($reponse->json('data.statements'))->pluck('status')->sort()->values()->all();
    $enPanne = collect($reponse->json('data.statements'))->firstWhere('status', 'failed');

    expect($statuts)->toBe(['failed', 'issued'])->and($enPanne['number'])->toBe('DC-2026-0002')->and(L::dans($scene['org'], fn () => DB::table('charge_sequences')->value('last_value')))->toBe(2);

    $this->postJson(C::url($scene['org'], "/statements/{$enPanne['id']}/retry"), [], ['Idempotency-Key' => 'reprise-0001'])->assertOk()->assertJsonPath('data.number', 'DC-2026-0002');
});

it('un exercice figé ne se modifie plus', function (): void {
    ['scene' => $scene, 'exercice' => $exercice] = E::calcule($this, 8000);
    E::emettre($this, $scene, $exercice)->assertOk();

    $this->patchJson(C::url($scene['org'], "/exercises/{$exercice}"), ['lock_version' => 9, 'items' => []])->assertStatus(409)->assertJsonPath('code', 'charge_exercise_state_invalid');
    E::calculer($this, $scene, $exercice)->assertStatus(409);
    $this->postJson(C::url($scene['org'], "/exercises/{$exercice}/discard"))->assertStatus(409);
});

it('un exercice dont la fin date de plus de trois ans demande l\'accusé de prescription, journalisé', function (): void {
    $this->travelTo('2026-11-16');
    $scene = E::sceneVide();
    E::bailSurLot($scene['org'], $scene['unit'], ['starts_on' => '2022-01-01', 'signed_on' => '2021-12-15']);
    C::comme($this, $scene['owner']);
    $depense = E::depense($this, $scene, 80000, ['service_from' => '2022-01-01', 'service_to' => '2023-01-01', 'document_on' => '2022-12-01', 'paid_on' => '2022-12-02']);
    $exercice = E::exercice($this, $scene, ['period_start' => '2022-01-01', 'period_end' => '2023-01-01', 'items' => [E::poste('Ascenseur', 'elevators', ['kind' => 'expense', 'id' => $depense, 'amount' => 80000], ['unit_id' => $scene['unit']->id])]])->assertCreated()->json('data.id');

    E::emettre($this, $scene, $exercice)->assertStatus(422)->assertJsonPath('code', 'charges_prescription_ack_required');
    E::emettre($this, $scene, $exercice, null, ['acknowledge_prescription' => true])->assertOk()->assertJsonPath('data.prescription_acknowledged', true);

    expect(DB::table('audit_logs')->where('action', 'charges.prescription.acknowledged')->count())->toBe(1);
});
