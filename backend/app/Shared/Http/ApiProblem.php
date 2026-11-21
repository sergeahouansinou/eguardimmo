<?php

declare(strict_types=1);

namespace App\Shared\Http;

use RuntimeException;
use Throwable;

final class ApiProblem extends RuntimeException
{
    /**
     * @param  array<string, string>  $headers
     * @param  array<string, mixed>  $extensions  membres ajoutés au corps de la réponse (RFC 9457, §3.2)
     */
    public function __construct(
        public readonly string $problemCode,
        public readonly int $status,
        public readonly string $title,
        string $detail,
        public readonly array $headers = [],
        ?Throwable $previous = null,
        public readonly array $extensions = [],
    ) {
        parent::__construct($detail, 0, $previous);
    }
}
