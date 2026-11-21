<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support\Parsers;

use App\Modules\Banking\Data\ParsedLine;
use App\Modules\Banking\Data\ParsedStatement;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\ErrorCode;
use App\Modules\Banking\Enums\StatementSource;
use App\Modules\Banking\Support\AmountParser;
use App\Modules\Banking\Support\Text;
use Carbon\CarbonImmutable;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

/**
 * camt.053.001.02 et .08 : aucun DOCTYPE ni entité, aucun accès réseau, un seul relevé par fichier, seules les
 * entrées `BOOK` sont importées. Une entrée illisible refuse tout le fichier : un relevé partiel casserait la chaîne des soldes.
 */
final readonly class CamtStatementParser
{
    public const NAMESPACES = [
        'urn:iso:std:iso:20022:tech:xsd:camt.053.001.02' => 'camt.053.001.02',
        'urn:iso:std:iso:20022:tech:xsd:camt.053.001.08' => 'camt.053.001.08',
    ];

    private const DEPTH_MAX = 24;

    public function parse(string $contenu, int $maxLines): ParsedStatement
    {
        $this->assertUtf8($contenu);

        if (preg_match('/<!\s*(DOCTYPE|ENTITY)/i', $contenu) === 1) {
            throw ErrorCode::StatementInvalid->problem('Le fichier XML contient une déclaration interdite.');
        }

        $erreurs = libxml_use_internal_errors(true);

        try {
            $document = new DOMDocument;

            if (! $document->loadXML($contenu, LIBXML_NONET | LIBXML_NOBLANKS) || $document->doctype !== null) {
                throw ErrorCode::StatementInvalid->problem('Le fichier XML est illisible.');
            }

            $racine = $document->documentElement;
            $espace = $racine?->namespaceURI;

            if ($racine === null || $racine->localName !== 'Document' || $espace === null || ! isset(self::NAMESPACES[$espace])) {
                throw ErrorCode::StatementFormatUnsupported->problem();
            }

            if ($this->depth($racine, 0) > self::DEPTH_MAX) {
                throw ErrorCode::StatementInvalid->problem('Le fichier XML est trop imbriqué.');
            }

            $this->validateSchema($document, self::NAMESPACES[$espace]);

            return $this->read($document, $espace, self::NAMESPACES[$espace], $maxLines);
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($erreurs);
        }
    }

    private function assertUtf8(string $contenu): void
    {
        if (str_contains($contenu, "\0") || ! mb_check_encoding($contenu, 'UTF-8')) {
            throw ErrorCode::StatementInvalid->problem('Le fichier XML doit être encodé en UTF-8.');
        }

        if (preg_match('/^(?:\xEF\xBB\xBF)?\s*<\?xml[^>]*?\sencoding\s*=\s*(["\'])(.*?)\1/is', $contenu, $m) === 1 && strtoupper(trim($m[2])) !== 'UTF-8') {
            throw ErrorCode::StatementInvalid->problem('Le fichier XML doit être encodé en UTF-8.');
        }
    }

    private function depth(DOMNode $noeud, int $niveau): int
    {
        $max = $niveau;

        foreach ($noeud->childNodes as $enfant) {
            if ($enfant instanceof DOMElement) {
                $max = max($max, $this->depth($enfant, $niveau + 1));

                if ($max > self::DEPTH_MAX) {
                    return $max;
                }
            }
        }

        return $max;
    }

    private function validateSchema(DOMDocument $document, string $version): void
    {
        $dossier = config('banking.xsd_directory');
        $xsd = is_string($dossier) && $dossier !== '' ? rtrim($dossier, '/').'/'.$version.'.xsd' : null;

        if ($xsd === null || ! is_file($xsd)) {
            if (config('banking.xsd_required') === true) {
                throw ErrorCode::XsdUnavailable->problem();
            }

            return;
        }

        if (! $document->schemaValidate($xsd, LIBXML_NONET)) {
            throw ErrorCode::StatementInvalid->problem('Le fichier ne respecte pas le schéma '.$version.'.');
        }
    }

    private function read(DOMDocument $document, string $espace, string $version, int $maxLines): ParsedStatement
    {
        $xp = new DOMXPath($document);
        $xp->registerNamespace('c', $espace);

        $releves = $this->nodes($xp, '/c:Document/c:BkToCstmrStmt/c:Stmt', null);

        if (count($releves) !== 1) {
            throw ErrorCode::StatementInvalid->problem('Le fichier doit contenir exactement un relevé.');
        }

        $stmt = $releves[0];
        $reference = Text::clean($this->text($xp, 'c:Id', $stmt), 64);

        if ($reference === null) {
            throw ErrorCode::StatementInvalid->problem('Identifiant de relevé absent.');
        }

        $identifiant = $this->text($xp, 'c:Acct/c:Id/c:IBAN', $stmt) ?? $this->text($xp, 'c:Acct/c:Id/c:Othr/c:Id', $stmt);
        $ouverture = $this->balance($xp, $stmt, 'OPBD');
        $cloture = $this->balance($xp, $stmt, 'CLBD');
        $lignes = [];
        $numero = 0;

        foreach ($this->nodes($xp, 'c:Ntry', $stmt) as $entree) {
            $numero++;

            if ($numero > $maxLines) {
                throw ErrorCode::StatementTooLarge->problem();
            }

            $statut = $this->text($xp, 'c:Sts/c:Cd', $entree) ?? $this->text($xp, 'c:Sts', $entree);

            if ($statut === 'BOOK') {
                $lignes[] = $this->entry($xp, $entree, $numero);
            }
        }

        $dates = array_map(static fn (ParsedLine $l): CarbonImmutable => $l->bookingDate, $lignes);
        $debut = $this->day($this->text($xp, 'c:FrToDt/c:FrDtTm', $stmt)) ?? ($dates === [] ? ($ouverture['date'] ?? null) : min($dates));
        $fin = $this->day($this->text($xp, 'c:FrToDt/c:ToDtTm', $stmt)) ?? ($dates === [] ? ($cloture['date'] ?? null) : max($dates));

        if ($debut === null || $fin === null || $fin->lessThan($debut)) {
            throw ErrorCode::StatementInvalid->problem('Période du relevé introuvable.');
        }

        $copie = in_array($this->text($xp, 'c:CpyDplctInd', $stmt), ['COPY', 'DUPL'], true);
        $sequence = $this->text($xp, 'c:ElctrncSeqNb', $stmt) ?? $this->text($xp, 'c:LglSeqNb', $stmt);

        return new ParsedStatement(
            StatementSource::Camt053, $version, $reference, Text::clean($sequence, 32), $debut, $fin,
            $ouverture['amount'] ?? null, $cloture['amount'] ?? null, $this->text($xp, 'c:Acct/c:Ccy', $stmt), $copie, $identifiant, $lignes, [],
        );
    }

    private function entry(DOMXPath $xp, DOMElement $entree, int $numero): ParsedLine
    {
        $montantNoeud = $this->nodes($xp, 'c:Amt', $entree)[0] ?? null;
        $devise = $montantNoeud?->getAttribute('Ccy') ?? '';
        $montant = $devise === '' ? null : AmountParser::minorUnits($this->text($xp, 'c:Amt', $entree) ?? '', $devise);
        $sens = match ($this->text($xp, 'c:CdtDbtInd', $entree)) {
            'CRDT' => Direction::Credit,
            'DBIT' => Direction::Debit,
            default => null,
        };
        $date = $this->day($this->text($xp, 'c:BookgDt/c:Dt', $entree) ?? $this->text($xp, 'c:BookgDt/c:DtTm', $entree));

        if ($montant === null || $montant <= 0 || $sens === null || $date === null) {
            throw ErrorCode::StatementInvalid->problem("Entrée {$numero} illisible.");
        }

        $details = $this->nodes($xp, 'c:NtryDtls/c:TxDtls', $entree);
        $unique = count($details) === 1 ? $details[0] : null;
        $ustrd = [];

        foreach ($this->nodes($xp, 'c:NtryDtls/c:TxDtls/c:RmtInf/c:Ustrd', $entree) as $noeud) {
            $ustrd[] = $noeud->textContent;
        }

        $code = $this->text($xp, 'c:BkTxCd/c:Domn/c:Cd', $entree);
        $transaction = $code !== null
            ? implode('-', array_filter([$code, $this->text($xp, 'c:BkTxCd/c:Domn/c:Fmly/c:Cd', $entree), $this->text($xp, 'c:BkTxCd/c:Domn/c:Fmly/c:SubFmlyCd', $entree)]))
            : $this->text($xp, 'c:BkTxCd/c:Prtry/c:Cd', $entree);
        $libelle = Text::clean(implode(' ', $ustrd), 500) ?? Text::clean($this->text($xp, 'c:AddtlNtryInf', $entree), 500) ?? '-';
        $partie = $sens === Direction::Credit ? 'Dbtr' : 'Cdtr';
        [$origineMontant, $origineDevise] = $unique === null ? [null, null] : $this->original($xp, $unique, $devise);
        $bout = $unique === null ? null : $this->text($xp, 'c:Refs/c:EndToEndId', $unique);
        $rvsl = $this->text($xp, 'c:RvslInd', $entree);

        return new ParsedLine(
            $numero, $date, $this->day($this->text($xp, 'c:ValDt/c:Dt', $entree) ?? $this->text($xp, 'c:ValDt/c:DtTm', $entree)), $sens, $montant, $devise,
            $origineMontant, $origineDevise, $rvsl === 'true' || $rvsl === '1',
            Text::clean($this->text($xp, 'c:AcctSvcrRef', $entree), 64), Text::clean($bout === 'NOTPROVIDED' ? null : $bout, 64), Text::clean($transaction, 40), $libelle,
            $unique === null ? null : Text::clean($this->text($xp, 'c:RmtInf/c:Strd/c:CdtrRefInf/c:Ref', $unique), 140),
            $unique === null ? null : Text::clean($this->text($xp, "c:RltdPties/c:{$partie}//c:Nm", $unique), 140),
            $unique === null ? null : ($this->text($xp, "c:RltdPties/c:{$partie}Acct/c:Id/c:IBAN", $unique) ?? $this->text($xp, "c:RltdPties/c:{$partie}Acct/c:Id/c:Othr/c:Id", $unique)),
        );
    }

    /**
     * @return array{0: int|null, 1: string|null}
     */
    private function original(DOMXPath $xp, DOMElement $transaction, string $devise): array
    {
        $noeud = $this->nodes($xp, 'c:AmtDtls/c:InstdAmt/c:Amt', $transaction)[0] ?? $this->nodes($xp, 'c:AmtDtls/c:TxAmt/c:Amt', $transaction)[0] ?? null;
        $code = $noeud?->getAttribute('Ccy') ?? '';

        if ($noeud === null || $code === '' || $code === $devise) {
            return [null, null];
        }

        $montant = AmountParser::minorUnits($noeud->textContent, $code);

        return $montant !== null && $montant > 0 ? [$montant, $code] : [null, null];
    }

    /**
     * @return array{amount?: int, date?: CarbonImmutable}
     */
    private function balance(DOMXPath $xp, DOMElement $stmt, string $type): array
    {
        $noeud = $this->nodes($xp, "c:Bal[c:Tp/c:CdOrPrtry/c:Cd='{$type}']", $stmt)[0] ?? null;

        if ($noeud === null) {
            return [];
        }

        $montant = $this->nodes($xp, 'c:Amt', $noeud)[0] ?? null;
        $devise = $montant?->getAttribute('Ccy') ?? '';
        $valeur = $montant === null || $devise === '' ? null : AmountParser::minorUnits($montant->textContent, $devise);
        $sens = $this->text($xp, 'c:CdtDbtInd', $noeud);

        if ($valeur === null || ! in_array($sens, ['CRDT', 'DBIT'], true)) {
            throw ErrorCode::StatementInvalid->problem('Solde du relevé illisible.');
        }

        $resultat = ['amount' => $sens === 'DBIT' ? -$valeur : $valeur];
        $date = $this->day($this->text($xp, 'c:Dt/c:Dt', $noeud) ?? $this->text($xp, 'c:Dt/c:DtTm', $noeud));

        return $date === null ? $resultat : [...$resultat, 'date' => $date];
    }

    /**
     * @return list<DOMElement>
     */
    private function nodes(DOMXPath $xp, string $chemin, ?DOMElement $contexte): array
    {
        $liste = $xp->query($chemin, $contexte);
        $elements = [];

        if ($liste !== false) {
            foreach ($liste as $noeud) {
                if ($noeud instanceof DOMElement) {
                    $elements[] = $noeud;
                }
            }
        }

        return $elements;
    }

    private function text(DOMXPath $xp, string $chemin, DOMElement $contexte): ?string
    {
        $noeud = $this->nodes($xp, $chemin, $contexte)[0] ?? null;
        $valeur = $noeud === null ? null : trim($noeud->textContent);

        return $valeur === '' ? null : $valeur;
    }

    private function day(?string $valeur): ?CarbonImmutable
    {
        if ($valeur === null || preg_match('/^(\d{4}-\d{2}-\d{2})/', $valeur, $m) !== 1) {
            return null;
        }

        $jour = CarbonImmutable::createFromFormat('!Y-m-d', $m[1]);

        return $jour !== null && $jour->format('Y-m-d') === $m[1] ? $jour : null;
    }
}
