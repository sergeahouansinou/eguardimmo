<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\OwnerFunds\OwnerFundsContext as F;

it('un règlement daté d\'un mois clos est reporté sur le premier jour ouvert avec sa date réelle en libellé', function (): void {
    ['org' => $org, 'bail' => $bail] = F::agence($this);
    F::encaisserEtCloturer($this, $org, $bail, 60000);
    $this->actingAs(L::titulaire($org));
    B::reauthentifier($this);
    $compte = B::compte($this, $org, 'trust_bank');
    B::importer($this, $org, $compte, B::camt([['2026-11-20', 'CRDT', '100.00', 'VIR COMPLEMENT']]), 'camt053', nom: 'r.xml')->assertCreated();
    $ligne = B::lignes($this, $org)['VIR COMPLEMENT'];

    $r = B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/settle"), [
        'action' => 'settle_lease', 'allocations' => [['lease_id' => $bail->id, 'amount' => 10000]], 'lock_version' => $ligne['lock_version'],
    ]);

    expect($r->status())->toBeIn([200, 201]);
    $ecriture = DB::table('journal_entries')->orderByDesc('created_at')->orderByDesc('id')->first();

    expect(substr((string) $ecriture->entry_date, 0, 10))->toBe('2026-12-01')->and($ecriture->label)->toContain('20/11/2026');
    expect(B::lignes($this, $org)['VIR COMPLEMENT']['state'])->toBe('matched');
});
