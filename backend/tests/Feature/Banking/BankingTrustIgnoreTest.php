<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

function bkPaireTiers(object $test, string $motif = 'bank_error'): array
{
    $tiers = B::compte($test, $test->org, 'trust_bank', B::AUTRE_IBAN);
    B::importer($test, $test->org, $tiers, B::csv([['16/11/2026', 'LOYER', '700,00'], ['16/11/2026', 'RETRAIT', '-700,00']], 'T'))->assertCreated();
    $lignes = B::lignes($test, $test->org);

    B::envoyer($test, 'POST', B::url($test->org, "/lines/{$lignes['RETRAIT']['id']}/ignore"), ['reason' => $motif, 'lock_version' => 1, 'pair_line_id' => $lignes['LOYER']['id']])->assertOk();

    return ['compte' => $tiers, 'loyer' => $lignes['LOYER'], 'retrait' => $lignes['RETRAIT']];
}

it('rétablit la paire entière quand une seule jambe est restaurée sur le compte de tiers', function (): void {
    $p = bkPaireTiers($this);
    $groupe = DB::table('bank_statement_lines')->where('id', $p['loyer']['id'])->value('ignore_group_id');

    expect($groupe)->not->toBeNull()->and(DB::table('bank_statement_lines')->where('id', $p['retrait']['id'])->value('ignore_group_id'))->toBe($groupe);

    $ignoree = B::lignes($this, $this->org)['LOYER'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$p['loyer']['id']}/restore"), ['lock_version' => $ignoree['lock_version']])->assertOk();

    $lignes = B::lignes($this, $this->org);
    expect($lignes['LOYER']['state'])->toBe('unmatched')->and($lignes['RETRAIT']['state'])->toBe('unmatched');
    expect(DB::table('bank_statement_lines')->whereNotNull('ignore_group_id')->count())->toBe(0);
    $this->artisan('banking:verify')->assertExitCode(0);
});

it('signale la restauration partielle d\'une paire, quel que soit le motif', function (): void {
    $p = bkPaireTiers($this, 'bank_error');
    DB::table('bank_statement_lines')->where('id', $p['loyer']['id'])->update(['state' => 'unmatched', 'ignore_reason' => null, 'ignore_group_id' => null]);

    $this->artisan('banking:verify')->assertExitCode(1)->expectsOutputToContain('trust_ignored_line_unpaired');
    expect(DB::table('audit_logs')->where('action', 'banking.verify.anomaly')->count())->toBe(1);
});

it('signale une ligne ignorée du compte de tiers sans groupe, même pour un motif autre que le virement interne', function (): void {
    $p = bkPaireTiers($this, 'bank_error');
    DB::table('bank_statement_lines')->whereIn('id', [$p['loyer']['id'], $p['retrait']['id']])->update(['ignore_group_id' => null]);

    $this->artisan('banking:verify')->assertExitCode(1)->expectsOutputToContain('trust_ignored_line_unpaired');
});

it('refuse de restaurer une ligne couverte par un état de rapprochement validé', function (): void {
    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-16', 'DBIT', '5.00', 'FRAIS']], ref: 'S1', ouverture: 0, cloture: -500, sequence: 'S1'), 'camt053', nom: 'a.xml')->assertCreated();
    $frais = B::lignes($this, $this->org)['FRAIS'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$frais['id']}/ignore"), ['reason' => 'out_of_scope', 'lock_version' => $frais['lock_version']])->assertOk();
    $etat = B::envoyer($this, 'POST', B::url($this->org, '/reconciliations'), ['bank_account_id' => $this->compte, 'month' => '2026-11'])->assertCreated();
    B::envoyer($this, 'POST', B::url($this->org, '/reconciliations/'.$etat->json('data.id').'/validate'))->assertOk();

    $ignoree = B::lignes($this, $this->org)['FRAIS'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$frais['id']}/restore"), ['lock_version' => $ignoree['lock_version']])->assertStatus(409)->assertJsonPath('code', 'bank_ignore_forbidden');
    expect(B::lignes($this, $this->org)['FRAIS']['state'])->toBe('ignored');
});

it('refuse de laisser de côté une ligne couverte par un état validé', function (): void {
    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-16', 'DBIT', '5.00', 'FRAIS']], ref: 'S1', ouverture: 0, cloture: -500, sequence: 'S1'), 'camt053', nom: 'a.xml')->assertCreated();
    $frais = B::lignes($this, $this->org)['FRAIS'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$frais['id']}/ignore"), ['reason' => 'out_of_scope', 'lock_version' => $frais['lock_version']])->assertOk();
    $etat = B::envoyer($this, 'POST', B::url($this->org, '/reconciliations'), ['bank_account_id' => $this->compte, 'month' => '2026-11'])->assertCreated();
    B::envoyer($this, 'POST', B::url($this->org, '/reconciliations/'.$etat->json('data.id').'/validate'))->assertOk();
    DB::table('bank_statement_lines')->where('id', $frais['id'])->update(['state' => 'unmatched', 'ignore_reason' => null]);
    $ligne = B::lignes($this, $this->org)['FRAIS'];

    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$frais['id']}/ignore"), ['reason' => 'out_of_scope', 'lock_version' => $ligne['lock_version']])->assertStatus(409)->assertJsonPath('code', 'bank_ignore_forbidden');
});
