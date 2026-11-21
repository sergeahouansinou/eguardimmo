<?php

declare(strict_types=1);

use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryCaseItem;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext as R;
use Tests\Feature\Recovery\RecoveryContext as X;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    X::preparer($this);
});

it('liste les impayés échus par RentLedger, avec le reste dû du grand livre et le dossier qui les porte', function (): void {
    $s = X::impayes($this);
    X::basculer($this, $s['org']);
    C::payer($this, $s['org'], $s['bail'], 25000)->assertCreated();

    $reponse = $this->getJson(X::url($s['org'], '/unpaid'))->assertOk();

    expect($reponse->json('data'))->toHaveCount(3)
        ->and(array_column($reponse->json('data'), 'installment_id'))->toBe($s['ids'])
        ->and(array_column(array_column($reponse->json('data'), 'outstanding'), 'amount'))->toBe([45000, 70000, 70000])
        ->and($reponse->json('data.0.lease.reference'))->toBe($s['bail']->reference)
        ->and($reponse->json('data.0.days_overdue'))->toBe(72)
        ->and($reponse->json('data.0.case'))->toBeNull()
        ->and($reponse->json('meta.next_after'))->toBeNull();

    $id = X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][0]])->assertCreated()->json('data.id');
    $this->getJson(X::url($s['org'], '/unpaid?per_page=2'))->assertOk()
        ->assertJsonPath('data.0.case.id', $id)
        ->assertJsonPath('data.0.case.number', 'RC-2026-0001')
        ->assertJsonPath('meta.next_after', $s['ids'][1]);
    $this->getJson(X::url($s['org'], '/unpaid?per_page=2&after='.$s['ids'][1]))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.next_after', null);
});

it('ouvre un dossier avec les créances choisies : montants relus au grand livre, jamais fournis par le client', function (): void {
    $s = X::impayes($this);
    X::basculer($this, $s['org']);
    C::payer($this, $s['org'], $s['bail'], 25000)->assertCreated();

    $reponse = $this->postJson(X::url($s['org'], '/cases'), [
        'lease_id' => $s['bail']->id,
        'debtor_party_id' => $s['locataire']->id,
        'installment_ids' => [$s['ids'][0], $s['ids'][1]],
        'amount' => 1,
        'status' => 'closed',
        'organization_id' => fake()->uuid(),
    ])->assertCreated();

    $reponse->assertJsonPath('data.number', 'RC-2026-0001')
        ->assertJsonPath('data.status', 'open')
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.items_count', 2)
        ->assertJsonPath('data.outstanding.amount', 115000)
        ->assertJsonPath('data.items.0.amount_due_at_inclusion.amount', 45000)
        ->assertJsonPath('data.items.0.total.amount', 70000)
        ->assertJsonPath('data.debtor.id', $s['locataire']->id);

    L::dans($s['org'], function () use ($s): void {
        $dossier = RecoveryCase::query()->firstOrFail();

        expect($dossier->organization_id)->toBe($s['org']->id)
            ->and($dossier->items)->toHaveCount(2)
            ->and($dossier->items->first()->amount_due->getAmount())->toBe('45000');
    });
});

it('numérote les dossiers RC-AAAA-NNNN sans trou, par organisation', function (): void {
    $a = X::impayes($this);
    $b = X::impayes($this, nom: 'Autre Agence');
    X::basculer($this, $a['org']);
    $a2 = C::bail($a['org']);
    foreach (['2026-09-16', '2026-10-16', '2026-11-16'] as $jour) {
        C::emises($a['org'], $a2['bail'], $this, $jour);
    }
    $ids2 = array_map(fn ($e): string => $e->id, C::echeances($a['org'], $a2['bail']));

    $premier = X::ouvrir($this, $a['org'], $a['bail'], $a['locataire'], [$a['ids'][0]])->assertCreated();
    $second = X::ouvrir($this, $a['org'], $a2['bail'], $a2['locataire'], [$ids2[0]])->assertCreated();
    $autre = X::ouvrir($this, $b['org'], $b['bail'], $b['locataire'], [$b['ids'][0]])->assertCreated();

    expect($premier->json('data.number'))->toBe('RC-2026-0001')
        ->and($second->json('data.number'))->toBe('RC-2026-0002')
        ->and($autre->json('data.number'))->toBe('RC-2026-0001');
});

it('refuse une créance dans un second dossier ouvert, la libère à la clôture du premier', function (): void {
    $s = X::dossier($this, 2);
    $autreLocataire = L::partie($s['org']);
    R::lier($s['org'], $s['bail'], $autreLocataire, ['valid_from' => '2026-01-01']);

    X::ouvrir($this, $s['org'], $s['bail'], $autreLocataire, [$s['ids'][0]])
        ->assertConflict()->assertJsonPath('code', 'recovery_receivable_taken');
    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(1);

    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/status"), ['status' => 'closed', 'reason' => 'Réglé à l\'amiable'])->assertOk();

    X::ouvrir($this, $s['org'], $s['bail'], $autreLocataire, [$s['ids'][0]])->assertCreated()->assertJsonPath('data.number', 'RC-2026-0002');
});

it('refuse un second dossier actif pour le même bail et le même débiteur', function (): void {
    $s = X::dossier($this, 1);

    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$s['ids'][2]])->assertConflict()->assertJsonPath('code', 'recovery_case_exists');
});

it('refuse une créance qui n\'est pas un impayé échu de ce bail, et un débiteur qui n\'est pas locataire', function (): void {
    $s = X::impayes($this);
    $autre = X::impayes($this, nom: 'Autre Agence');
    $partie = L::partie($s['org']);

    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [fake()->uuid()])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    X::ouvrir($this, $s['org'], $s['bail'], $s['locataire'], [$autre['ids'][0]])->assertUnprocessable()->assertJsonPath('code', 'recovery_receivable_invalid');
    X::ouvrir($this, $s['org'], $s['bail'], $partie, [$s['ids'][0]])->assertUnprocessable()->assertJsonPath('code', 'recovery_debtor_invalid');
    X::ouvrir($this, $s['org'], $s['bail'], $autre['locataire'], [$s['ids'][0]])->assertUnprocessable()->assertJsonPath('code', 'recovery_debtor_invalid');
    $this->postJson(X::url($s['org'], '/cases'), ['lease_id' => $s['bail']->id, 'debtor_party_id' => $s['locataire']->id, 'installment_ids' => []])->assertUnprocessable();

    expect(L::dans($s['org'], fn () => RecoveryCase::query()->count()))->toBe(0);
});

it('ajoute et retire une créance sans rien effacer, rejouable', function (): void {
    $s = X::dossier($this, 1);
    $url = X::url($s['org'], "/cases/{$s['case']}");

    $ajout = $this->postJson("{$url}/items", ['installment_ids' => [$s['ids'][1], $s['ids'][2], $s['ids'][0]]])->assertOk();
    $ajout->assertJsonPath('data.items_count', 3)->assertJsonPath('data.outstanding.amount', 210000);
    $this->postJson("{$url}/items", ['installment_ids' => [$s['ids'][1]]])->assertOk()->assertJsonPath('data.items_count', 3);

    $ligne = $ajout->json('data.items.1.id');
    $retrait = $this->deleteJson("{$url}/items/{$ligne}")->assertOk();
    $retrait->assertJsonPath('data.items_count', 2)->assertJsonPath('data.outstanding.amount', 140000);

    expect(collect($retrait->json('data.items'))->firstWhere('id', $ligne)['removed_at'])->not->toBeNull()
        ->and(L::dans($s['org'], fn () => RecoveryCaseItem::query()->count()))->toBe(3);

    $this->deleteJson("{$url}/items/{$ligne}")->assertNotFound()->assertJsonPath('code', 'recovery_item_not_found');
    $this->postJson("{$url}/items", ['installment_ids' => [$s['ids'][1]]])->assertOk()->assertJsonPath('data.items_count', 3);
    expect(L::dans($s['org'], fn () => RecoveryCaseItem::query()->count()))->toBe(4);
});

it('refuse d\'ajouter une créance déjà portée par un autre dossier actif', function (): void {
    $s = X::dossier($this, 1);
    $autreLocataire = L::partie($s['org']);
    R::lier($s['org'], $s['bail'], $autreLocataire, ['valid_from' => '2026-01-01']);
    $second = X::ouvrir($this, $s['org'], $s['bail'], $autreLocataire, [$s['ids'][1]])->assertCreated()->json('data.id');

    $this->postJson(X::url($s['org'], "/cases/{$second}/items"), ['installment_ids' => [$s['ids'][0]]])->assertConflict()->assertJsonPath('code', 'recovery_receivable_taken');
});

it('change le statut : open et in_plan s\'échangent, closed est définitif et ferme le dossier', function (): void {
    $s = X::dossier($this, 1);
    $url = X::url($s['org'], "/cases/{$s['case']}/status");

    $this->postJson($url, ['status' => 'in_plan'])->assertOk()->assertJsonPath('data.status', 'in_plan');
    $this->postJson($url, ['status' => 'open'])->assertOk()->assertJsonPath('data.status', 'open');
    $this->postJson($url, ['status' => 'bidon'])->assertUnprocessable();
    $this->postJson($url, ['status' => 'uncollectible', 'reason' => 'Locataire insolvable'])->assertOk()
        ->assertJsonPath('data.status', 'uncollectible')->assertJsonPath('data.closed_on', '2026-11-16')->assertJsonPath('data.status_reason', 'Locataire insolvable');
    $this->postJson($url, ['status' => 'open'])->assertConflict()->assertJsonPath('code', 'recovery_status_transition_invalid');
    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/items"), ['installment_ids' => [$s['ids'][1]]])->assertConflict()->assertJsonPath('code', 'recovery_case_not_active');
    $this->postJson(X::url($s['org'], "/cases/{$s['case']}/bundles"))->assertConflict()->assertJsonPath('code', 'recovery_case_not_active');
});

it('tient le carnet des diligences : actes manuels datés, jamais d\'acte système saisi à la main', function (): void {
    $s = X::dossier($this, 1);
    $url = X::url($s['org'], "/cases/{$s['case']}/acts");

    $this->postJson($url, ['type' => 'call', 'performed_on' => '2026-11-16', 'note' => 'Le locataire promet un virement'])->assertCreated()
        ->assertJsonPath('data.type', 'call')->assertJsonPath('data.performed_on', '2026-11-16')->assertJsonPath('data.author_user_id', L::titulaire($s['org'])->id);
    $this->postJson($url, ['type' => 'formal_notice', 'performed_on' => '2026-11-16', 'reference' => 'LRAR 1A234'])->assertCreated();

    foreach (['transmission', 'revocation', 'bidon'] as $type) {
        $this->postJson($url, ['type' => $type, 'performed_on' => '2026-11-10'])->assertUnprocessable();
    }

    $this->postJson($url, ['type' => 'note', 'performed_on' => '2027-01-01'])->assertUnprocessable();

    $liste = $this->getJson($url)->assertOk();
    expect(array_column($liste->json('data'), 'type'))->toBe(['formal_notice', 'call']);
});

it('liste et filtre les dossiers, avec le reste dû lu au grand livre', function (): void {
    $s = X::dossier($this, 2);
    X::basculer($this, $s['org']);
    C::payer($this, $s['org'], $s['bail'], 70000)->assertCreated();

    $this->getJson(X::url($s['org'], '/cases'))->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $s['case'])->assertJsonPath('data.0.outstanding.amount', 70000)->assertJsonPath('data.0.lease.reference', $s['bail']->reference);
    $this->getJson(X::url($s['org'], '/cases?status=closed'))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(X::url($s['org'], '/cases?status=open&lease='.$s['bail']->id.'&debtor='.$s['locataire']->id))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(X::url($s['org'], '/cases?status=bidon'))->assertUnprocessable();
});
