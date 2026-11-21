<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use Carbon\CarbonInterface;
use InvalidArgumentException;

/**
 * Horaires du support servis par le serveur (ADR 0033, décision 8) : « 1-5 09:00-18:00 », fenêtres séparées par « ; », jours ISO
 * (1 = lundi). Une valeur illisible lève une erreur : jamais d'horaires inventés.
 */
final readonly class SupportHours
{
    private const array JOURS = [1 => 'lun.', 2 => 'mar.', 3 => 'mer.', 4 => 'jeu.', 5 => 'ven.', 6 => 'sam.', 7 => 'dim.'];

    /**
     * @param  list<array{days: list<int>, from: string, to: string}>  $windows
     */
    private function __construct(private array $windows, public string $timezone) {}

    public static function fromConfig(): self
    {
        $horaires = config('messaging.support.hours');
        $fuseau = config('messaging.support.timezone');

        if (! is_string($horaires) || ! is_string($fuseau)) {
            throw new InvalidArgumentException('SUPPORT_HOURS et SUPPORT_TIMEZONE doivent être des chaînes.');
        }

        return self::parse($horaires, $fuseau);
    }

    public static function parse(string $horaires, string $fuseau): self
    {
        if (! in_array($fuseau, timezone_identifiers_list(), true)) {
            throw new InvalidArgumentException("SUPPORT_TIMEZONE inconnu : {$fuseau}.");
        }

        $fenetres = [];

        foreach (explode(';', $horaires) as $brut) {
            if (preg_match('/^\s*([1-7])(?:-([1-7]))?\s+([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)\s*$/', $brut, $m) !== 1) {
                throw new InvalidArgumentException("SUPPORT_HOURS illisible : {$brut}.");
            }

            $fin = (int) ($m[2] === '' ? $m[1] : $m[2]);

            if ($fin < (int) $m[1] || "{$m[3]}:{$m[4]}" >= "{$m[5]}:{$m[6]}") {
                throw new InvalidArgumentException("SUPPORT_HOURS incohérent : {$brut}.");
            }

            $fenetres[] = ['days' => range((int) $m[1], $fin), 'from' => "{$m[3]}:{$m[4]}", 'to' => "{$m[5]}:{$m[6]}"];
        }

        return new self($fenetres, $fuseau);
    }

    public function isOnline(CarbonInterface $maintenant): bool
    {
        $local = $maintenant->copy()->setTimezone($this->timezone);
        $heure = $local->format('H:i');

        foreach ($this->windows as $fenetre) {
            if (in_array($local->isoWeekday(), $fenetre['days'], true) && $heure >= $fenetre['from'] && $heure < $fenetre['to']) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<array{days: list<int>, from: string, to: string}>
     */
    public function windows(): array
    {
        return $this->windows;
    }

    public function label(): string
    {
        $morceaux = array_map(function (array $fenetre): string {
            $premier = $fenetre['days'][0];
            $dernier = $fenetre['days'][count($fenetre['days']) - 1];
            $jours = $premier === $dernier ? self::JOURS[$premier] : ucfirst(self::JOURS[$premier]).'–'.self::JOURS[$dernier];

            return sprintf('%s %s – %s', $jours, self::heure($fenetre['from']), self::heure($fenetre['to']));
        }, $this->windows);

        return implode(', ', $morceaux).' ('.$this->timezone.')';
    }

    private static function heure(string $hhmm): string
    {
        [$h, $m] = explode(':', $hhmm);

        return $m === '00' ? ((int) $h).' h' : ((int) $h).' h '.$m;
    }
}
