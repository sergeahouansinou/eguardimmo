<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

it('propose le bail dont l\'échéance impayée égale le montant, sans rien écrire', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIREMENT INCONNU', '700,00']]))->assertCreated();

    $suggestion = B::lignes($this, $this->org)['VIREMENT INCONNU']['suggestion'];

    expect($suggestion['action'])->toBe('settle_lease')->and($suggestion['targets'][0]['id'])->toBe($this->bail->id)->and($suggestion['explanation']['codes'])->not->toBeEmpty();
    expect(DB::table('rent_payments')->count())->toBe(0)->and(DB::table('bank_matches')->count())->toBe(0);
});

it('ne propose rien de fort pour un montant sans échéance ni écriture', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIREMENT ETRANGE', '123,45']]))->assertCreated();

    $suggestion = B::lignes($this, $this->org)['VIREMENT ETRANGE']['suggestion'];

    expect($suggestion === null || $suggestion['confidence'] !== 'strong')->toBeTrue();
});

it('une suggestion faible n\'est jamais présélectionnée', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR AMBIGU', '700,00']]))->assertCreated();

    $suggestion = B::lignes($this, $this->org)['VIR AMBIGU']['suggestion'];

    expect($suggestion)->not->toBeNull()->and($suggestion['preselected'])->toBeFalse()->and($suggestion['confidence'])->not->toBe('strong');
});

it('apprend la contrepartie d\'un règlement validé et la propose ensuite', function (): void {
    $profil = B::profil();
    $profil['columns']['counterparty_iban'] = 'IBAN';
    $compte = $this->compte;
    B::envoyer($this, 'PATCH', B::url($this->org, "/accounts/{$compte}"), ['label' => 'Compte courant', 'csv_profile' => $profil])->assertOk();
    $ligne = fn (string $libelle, string $montant, string $date) => "Date;Libelle;Montant;Ref;IBAN\n{$date};{$libelle};{$montant};{$libelle};DE89370400440532013000\n";

    B::importer($this, $this->org, $compte, $ligne('PREMIER', '300,00', '16/11/2026'))->assertCreated();
    $premiere = B::lignes($this, $this->org)['PREMIER'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$premiere['id']}/settle"), [
        'action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 30000]], 'lock_version' => $premiere['lock_version'],
    ])->assertSuccessful();

    B::importer($this, $this->org, $compte, $ligne('SECOND', '400,00', '16/11/2026'))->assertCreated();
    $suggestion = B::lignes($this, $this->org)['SECOND']['suggestion'];

    expect($suggestion)->not->toBeNull()->and(json_encode($suggestion))->toContain($this->bail->id)->toContain('known_counterparty');
    expect(DB::table('bank_counterparty_links')->count())->toBe(1);
});
