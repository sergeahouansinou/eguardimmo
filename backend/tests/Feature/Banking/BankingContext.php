<?php

declare(strict_types=1);

namespace Tests\Feature\Banking;

use App\Modules\Banking\Models\OrganizationBankAccount;
use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Leases\Models\Lease;
use App\Modules\Organizations\Models\Organization;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

final class BankingContext
{
    public const string IBAN = 'FR7630006000011234567890189';

    public const string AUTRE_IBAN = 'FR1420041010050500013M02606';

    public const string DEBUT = '2026-01-01';

    /**
     * @return array<string, mixed>
     */
    public static function profil(bool $reference = true): array
    {
        $profil = [
            'delimiter' => ';', 'encoding' => 'UTF-8', 'has_header' => true, 'date_format' => 'd/m/Y',
            'decimal_separator' => ',', 'thousands_separator' => ' ',
            'columns' => ['booking_date' => 'Date', 'label' => 'Libelle', 'amount' => 'Montant', 'bank_reference' => 'Ref'],
        ];

        if (! $reference) {
            unset($profil['columns']['bank_reference']);
        }

        return $profil;
    }

    public static function agence(object $test): Organization
    {
        C::preparer($test);
        $org = C::organisation();
        $test->actingAs(L::titulaire($org));
        self::reauthentifier($test);

        return $org;
    }

    public static function reauthentifier(object $test): void
    {
        config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
        $test->withHeaders(['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/']);
        $test->flushSession();
        $test->withSession([EnsureRecentReauthentication::CLE_2FA => now()->getTimestamp()]);
    }

    public static function url(Organization $org, string $chemin = ''): string
    {
        return "/api/v1/org/{$org->id}/banking{$chemin}";
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function envoyer(object $test, string $methode, string $url, array $corps = [], ?string $cle = null): TestResponse
    {
        return $test->json($methode, $url, $corps, ['Idempotency-Key' => $cle ?? 'cle-'.bin2hex(random_bytes(8))]);
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function compte(object $test, Organization $org, string $role = 'bank', string $iban = self::IBAN, array $surcharges = []): string
    {
        $reponse = self::envoyer($test, 'POST', self::url($org, '/accounts'), [
            'ledger_role' => $role, 'label' => 'Compte courant', 'bank_name' => 'Banque Test', 'holder_name' => 'Agence du Port',
            'identifier_kind' => 'iban', 'identifier' => $iban, 'reconciliation_from' => self::DEBUT, 'opening_bank_balance' => 0,
            'csv_profile' => self::profil(), ...$surcharges,
        ]);
        $reponse->assertCreated();

        return (string) $reponse->json('data.id');
    }

    /**
     * @param  list<array{0: string, 1: string, 2: string}>  $lignes  date d/m/Y, libellé, montant décimal « 650,00 »
     */
    public static function csv(array $lignes, ?string $prefixe = 'R'): string
    {
        $sortie = $prefixe === null ? "Date;Libelle;Montant\n" : "Date;Libelle;Montant;Ref\n";

        foreach ($lignes as $i => [$date, $libelle, $montant]) {
            $sortie .= "{$date};{$libelle};{$montant}".($prefixe === null ? '' : ";{$prefixe}".($i + 1))."\n";
        }

        return $sortie;
    }

    /**
     * @param  array<string, mixed>  $surcharges
     */
    public static function importer(object $test, Organization $org, string $compte, string $contenu, string $format = 'csv', ?string $cle = null, array $surcharges = [], string $nom = 'releve.csv'): TestResponse
    {
        $corps = ['file' => UploadedFile::fake()->createWithContent($nom, $contenu), 'format' => $format, ...$surcharges];

        return $test->post(self::url($org, "/accounts/{$compte}/statements"), $corps, ['Idempotency-Key' => $cle ?? 'cle-'.bin2hex(random_bytes(8)), 'Accept' => 'application/json']);
    }

    public static function compteModele(Organization $org, string $id): OrganizationBankAccount
    {
        return L::dans($org, fn (): OrganizationBankAccount => OrganizationBankAccount::query()->findOrFail($id));
    }

    /**
     * camt.053 minimal, une seule banque fictive par version : `02` ou `08`.
     *
     * @param  list<array{0: string, 1: string, 2: string, 3: string}>  $entrees  date Y-m-d, CRDT|DBIT, montant « 650.00 », libellé
     */
    public static function camt(array $entrees, string $version = '02', string $ref = 'STMT-1', ?int $ouverture = 0, ?int $cloture = null, string $de = '2026-11-01', string $a = '2026-11-30', string $iban = self::IBAN, bool $copie = false, string $sequence = '1'): string
    {
        $ns = "urn:iso:std:iso:20022:tech:xsd:camt.053.001.{$version}";
        $solde = static fn (string $code, int $montant, string $date): string => '<Bal><Tp><CdOrPrtry><Cd>'.$code.'</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">'
            .number_format(abs($montant) / 100, 2, '.', '').'</Amt><CdtDbtInd>'.($montant < 0 ? 'DBIT' : 'CRDT').'</CdtDbtInd><Dt><Dt>'.$date.'</Dt></Dt></Bal>';
        $lignes = '';

        foreach ($entrees as $i => [$date, $sens, $montant, $libelle]) {
            $lignes .= '<Ntry><Amt Ccy="EUR">'.$montant.'</Amt><CdtDbtInd>'.$sens.'</CdtDbtInd><Sts>BOOK</Sts><BookgDt><Dt>'.$date.'</Dt></BookgDt>'
                .'<AcctSvcrRef>'.$ref.'-'.($i + 1).'</AcctSvcrRef><NtryDtls><TxDtls><Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>'
                .'<RltdPties><Dbtr><Nm>Jean Dupont</Nm></Dbtr></RltdPties><RmtInf><Ustrd>'.$libelle.'</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>';
        }

        return '<?xml version="1.0" encoding="UTF-8"?><Document xmlns="'.$ns.'"><BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId></GrpHdr><Stmt><Id>'.$ref.'</Id>'
            .'<ElctrncSeqNb>'.$sequence.'</ElctrncSeqNb>'
            .'<FrToDt><FrDtTm>'.$de.'T00:00:00</FrDtTm><ToDtTm>'.$a.'T23:59:59</ToDtTm></FrToDt>'.($copie ? '<CpyDplctInd>COPY</CpyDplctInd>' : '')
            .'<Acct><Id><IBAN>'.$iban.'</IBAN></Id><Ccy>EUR</Ccy></Acct>'
            .($ouverture === null ? '' : $solde('OPBD', $ouverture, $de)).($cloture === null ? '' : $solde('CLBD', $cloture, $a))
            .$lignes.'</Stmt></BkToCstmrStmt></Document>';
    }

    /**
     * Agence, bail émis et compte de banque suivi.
     *
     * @return array{org: Organization, bail: Lease, compte: string}
     */
    public static function loyers(object $test, bool $avecCompte = true): array
    {
        $org = self::agence($test);
        ['bail' => $bail] = C::bail($org);
        C::emises($org, $bail, $test);

        return ['org' => $org, 'bail' => $bail, 'compte' => $avecCompte ? self::compte($test, $org) : ''];
    }

    /**
     * @return list<string> identifiants des lignes d'écriture de la banque (débits), du plus ancien au plus récent
     */
    public static function ecritures(object $test, Organization $org, string $compte): array
    {
        $lignes = $test->getJson(self::url($org, "/book-lines?account_id={$compte}"))->assertOk()->json('data');

        return array_column($lignes, 'line_id');
    }

    /**
     * @return array<string, array<string, mixed>> lignes de relevé par libellé
     */
    public static function lignes(object $test, Organization $org): array
    {
        $parLibelle = [];

        foreach ($test->getJson(self::url($org, '/lines'))->assertOk()->json('data') as $ligne) {
            $parLibelle[$ligne['label']] = $ligne;
        }

        return $parLibelle;
    }
}
