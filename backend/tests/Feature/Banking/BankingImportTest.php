<?php

declare(strict_types=1);

use App\Modules\Banking\Models\BankStatement;
use App\Modules\Banking\Models\BankStatementLine;
use Illuminate\Http\UploadedFile;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    $this->org = B::agence($this);
    $this->compte = B::compte($this, $this->org);
    $this->csv = B::csv([['02/11/2026', 'VIR LOYER DUPONT', '650,00'], ['03/11/2026', 'FRAIS TENUE', '-12,50']]);
});

it('importe un CSV : relevé, lignes signées, période, fichier stocké', function (): void {
    $r = B::importer($this, $this->org, $this->compte, $this->csv)->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(2)
        ->and($r->json('data.period_from'))->toBe('2026-11-02')
        ->and($r->json('data.period_to'))->toBe('2026-11-03')
        ->and($r->json('data.has_file'))->toBeTrue();

    $lignes = $this->getJson(B::url($this->org, '/lines'))->assertOk()->json('data');
    $montants = array_map(static fn (array $l): int => $l['signed_amount']['amount'], $lignes);
    sort($montants);

    expect($montants)->toBe([-1250, 65000]);
    $this->getJson(B::url($this->org, "/statements/{$r->json('data.id')}/file"))->assertOk();
});

it('rejoue la même Idempotency-Key sans rien dupliquer', function (): void {
    $a = B::importer($this, $this->org, $this->compte, $this->csv, 'csv', 'cle-import-1')->assertCreated();
    $b = B::importer($this, $this->org, $this->compte, $this->csv, 'csv', 'cle-import-1');

    expect($b->status())->toBeIn([200, 201])->and($b->json('data.id'))->toBe($a->json('data.id'));
    expect(L::dans($this->org, fn () => BankStatementLine::query()->count()))->toBe(2);
});

it('exige une Idempotency-Key', function (): void {
    $this->post(B::url($this->org, "/accounts/{$this->compte}/statements"), ['file' => UploadedFile::fake()->createWithContent('r.csv', $this->csv), 'format' => 'csv'], ['Accept' => 'application/json'])
        ->assertStatus(422)->assertJsonPath('code', 'banking_idempotency_key_required');
});

it('renvoie 200 pour un même fichier (sha256) sous une autre clé', function (): void {
    $a = B::importer($this, $this->org, $this->compte, $this->csv)->assertCreated();
    $b = B::importer($this, $this->org, $this->compte, $this->csv)->assertOk();

    expect($b->json('data.id'))->toBe($a->json('data.id'));
    expect(L::dans($this->org, fn () => [BankStatement::query()->count(), BankStatementLine::query()->count()]))->toBe([1, 2]);
});

it('dédoublonne par référence bancaire quand elle existe', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'CAFE', '-3,00'], ['03/11/2026', 'THE', '-4,00']]))->assertCreated();
    $r = B::importer($this, $this->org, $this->compte, B::csv([['02/11/2026', 'CAFE', '-3,00'], ['03/11/2026', 'THE', '-4,00'], ['04/11/2026', 'AUTRE', '10,00']]))->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(1)->and($r->json('data.lines_duplicated'))->toBe(2);
});

it('sans référence, garde deux frais identiques du jour et ignore le chevauchement de deux CSV', function (): void {
    $sans = B::compte($this, $this->org, 'trust_bank', B::AUTRE_IBAN, ['csv_profile' => B::profil(false)]);
    $frais = [['02/11/2026', 'CAFE', '-3,00'], ['02/11/2026', 'CAFE', '-3,00']];

    B::importer($this, $this->org, $sans, B::csv($frais, null))->assertCreated();
    $r = B::importer($this, $this->org, $sans, B::csv([...$frais, ['02/11/2026', 'CAFE', '-3,00'], ['04/11/2026', 'AUTRE', '10,00']], null))->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(2)->and($r->json('data.lines_duplicated'))->toBe(2);
    expect(L::dans($this->org, fn () => BankStatementLine::query()->where('bank_account_id', $sans)->count()))->toBe(4);
});

it('refuse un relevé dont l\'IBAN n\'est pas celui du compte', function (): void {
    $camt = B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']], iban: B::AUTRE_IBAN);

    B::importer($this, $this->org, $this->compte, $camt, 'camt053', nom: 'r.xml')->assertStatus(422)->assertJsonPath('code', 'bank_statement_account_mismatch');
    expect(L::dans($this->org, fn () => BankStatement::query()->count()))->toBe(0);
});

it('importe camt.053.001.02 et .08 avec leurs soldes', function (string $version): void {
    $camt = B::camt([['2026-11-02', 'CRDT', '650.00', 'LOYER NOVEMBRE'], ['2026-11-03', 'DBIT', '12.50', 'FRAIS']], $version, "STMT-{$version}", 0, 63750);

    $r = B::importer($this, $this->org, $this->compte, $camt, 'camt053', nom: 'r.xml')->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(2)
        ->and($r->json('data.format_version'))->toBe("camt.053.001.{$version}")
        ->and($r->json('data.closing_balance.amount'))->toBe(63750);
})->with(['02', '08']);

it('enregistre une copie CpyDplctInd sans importer de lignes', function (): void {
    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']]), 'camt053', nom: 'a.xml')->assertCreated();
    $copie = B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']], ref: 'STMT-2', copie: true), 'camt053', nom: 'b.xml')->assertCreated();

    expect($copie->json('data.is_copy'))->toBeTrue()->and($copie->json('data.lines_imported'))->toBe(0);
    expect(L::dans($this->org, fn () => BankStatementLine::query()->count()))->toBe(1);
});

it('dédoublonne un même relevé (référence et séquence) sous un autre contenu binaire', function (): void {
    $camt = B::camt([['2026-11-02', 'CRDT', '10.00', 'VIR']]);
    B::importer($this, $this->org, $this->compte, $camt, 'camt053', nom: 'a.xml')->assertCreated();
    $b = B::importer($this, $this->org, $this->compte, $camt.'<!-- réémission -->', 'camt053', nom: 'b.xml')->assertCreated();

    expect($b->json('data.lines_imported'))->toBe(0)->and($b->json('data.lines_duplicated'))->toBe(1);
    expect(L::dans($this->org, fn () => BankStatementLine::query()->count()))->toBe(1);
});

it('signale un trou de continuité entre deux relevés chaînés', function (): void {
    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'A']], ref: 'S1', ouverture: 0, cloture: 1000, de: '2026-11-01', a: '2026-11-30'), 'camt053', nom: 'a.xml')->assertCreated();
    B::importer($this, $this->org, $this->compte, B::camt([['2026-12-02', 'CRDT', '10.00', 'B']], ref: 'S2', ouverture: 5000, cloture: 6000, de: '2026-12-01', a: '2026-12-31', sequence: '2'), 'camt053', nom: 'b.xml')->assertCreated();

    $dernier = L::dans($this->org, fn () => BankStatement::query()->where('statement_ref', 'S2')->value('id'));
    $trous = $this->getJson(B::url($this->org, "/statements/{$dernier}"))->assertOk()->json('meta.gaps');
    expect($trous)->toHaveCount(1)->and($trous[0]['expected_opening'])->toBe(1000)->and($trous[0]['actual_opening'])->toBe(5000);
});

it('refuse les fichiers hostiles', function (string $contenu, string $nom, string $format): void {
    B::importer($this, $this->org, $this->compte, $contenu, $format, nom: $nom)->assertStatus(422);
    expect(L::dans($this->org, fn () => BankStatement::query()->count()))->toBe(0);
})->with([
    'DOCTYPE / XXE' => ['<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">&x;</Document>', 'r.xml', 'camt053'],
    'DOCTYPE sur un relevé valide' => [str_replace('<Document ', '<!DOCTYPE Document [<!ENTITY a "b">]><Document ', B::camt([['2026-11-02', 'CRDT', '1.00', 'x']])), 'r.xml', 'camt053'],
    'PHP' => ["<?php system('id'); ?>", 'r.csv', 'csv'],
    'ZIP' => ["PK\x03\x04\x14\x00\x00\x00", 'r.csv', 'csv'],
    'binaire NUL' => ["Date;Libelle;Montant\n02/11/2026;A\0B;1,00\n", 'r.csv', 'csv'],
    'XML hors espace camt' => ['<?xml version="1.0"?><Document xmlns="urn:autre"><x/></Document>', 'r.xml', 'camt053'],
    'CSV annoncé mais XML' => [B::camt([['2026-11-02', 'CRDT', '1.00', 'x']]), 'r.csv', 'csv'],
]);

it('refuse un fichier de plus de 10 Mo et plus de 20 000 lignes', function (): void {
    config(['banking.import_max_bytes' => 1000]);
    B::importer($this, $this->org, $this->compte, str_repeat('x', 1001))->assertStatus(422)->assertJsonPath('code', 'bank_statement_too_large');

    config(['banking.import_max_bytes' => 10_000_000, 'banking.import_max_lines' => 3]);
    $lignes = array_fill(0, 4, ['02/11/2026', 'X', '1,00']);
    B::importer($this, $this->org, $this->compte, B::csv($lignes))->assertStatus(422)->assertJsonPath('code', 'bank_statement_too_large');
});

it('rejette les lignes CSV invalides avec leur numéro sans les contenir', function (): void {
    $r = B::importer($this, $this->org, $this->compte, "Date;Libelle;Montant;Ref\n32/13/2026;SECRET;1,00;R1\n02/11/2026;OK;5,00;R2\n")->assertCreated();

    expect($r->json('data.lines_imported'))->toBe(1)->and($r->json('data.lines_rejected'))->toBe(1)
        ->and(json_encode($r->json('meta.rejected')))->not->toContain('SECRET');
});

it('prévisualise sans rien écrire', function (): void {
    $r = $this->post(B::url($this->org, "/accounts/{$this->compte}/statements/preview"), ['file' => UploadedFile::fake()->createWithContent('r.csv', $this->csv), 'format' => 'csv'], ['Accept' => 'application/json'])->assertOk();

    expect(L::dans($this->org, fn () => BankStatement::query()->count()))->toBe(0)->and($r->json('data'))->not->toBeNull();
});

it('annule un relevé dont aucune ligne n\'est pointée', function (): void {
    $id = B::importer($this, $this->org, $this->compte, $this->csv)->assertCreated()->json('data.id');

    B::envoyer($this, 'POST', B::url($this->org, "/statements/{$id}/void"), ['reason' => 'Mauvais fichier'])->assertOk();
    expect(L::dans($this->org, fn () => BankStatement::query()->whereNotNull('voided_at')->count()))->toBe(1);
});
