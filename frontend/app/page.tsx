"use client"

import { useState, useEffect, useRef } from "react"
import Layout from "../components/Layout"
import Link from "next/link"

export default function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const videoRef = useRef(null)

  const slides = [
    {
      title: "Blockchain Security",
      content: "Immutable records that cannot be tampered with or forged",
    },
    {
      title: "Instant Verification",
      content: "Real-time verification of employee credentials and background",
    },
    {
      title: "Cloud Efficiency",
      content: "Scalable cloud infrastructure for enterprise-level operations",
    },
    {
      title: "Global Access",
      content: "Access verification records from anywhere in the world",
    },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [slides.length])

  // ✅ Toggle play/pause on click
  const handleVideoClick = () => {
    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }

  return (
    <Layout>
      <section className="hero">
        <div className="container">
          <h1>BlockHire – Tamper-Proof Employee Verification</h1>
          <p>Blockchain immutability meets cloud efficiency.</p>
          <Link href="/login" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </section>

      <section className="container">
        <div className="card">
          <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>What We Do?</h2>
          <div className="features">
            <div className="feature-card">
              <h3>Prevent Resume Fraud</h3>
              <p>Blockchain-verified employment records eliminate fake credentials and resume fraud.</p>
            </div>
            <div className="feature-card">
              <h3>Instant Verification</h3>
              <p>Verify employee backgrounds in seconds, not days or weeks.</p>
            </div>
            <div className="feature-card">
              <h3>Immutable Records</h3>
              <p>Once recorded on blockchain, employment data cannot be altered or deleted.</p>
            </div>
            <div className="feature-card">
              <h3>Global Access</h3>
              <p>Access verification records from anywhere in the world, 24/7.</p>
            </div>
            <div className="feature-card">
              <h3>Privacy by Design</h3>
              <p>Only essential data is revealed during verification with user consent controls.</p>
            </div>
            <div className="feature-card">
              <h3>Auditable History</h3>
              <p>Every change is tracked so employers can trust the full employment timeline.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>Features</h2>
          <div className="carousel">
            <button
              type="button"
              aria-label="Previous slide"
              className="carousel-arrow left"
              onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
            >
              {/* chevron-left icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="carousel-inner">
              {slides.map((slide, index) => (
                <div key={index} className={`carousel-slide ${index === currentSlide ? "active" : ""}`}>
                  <h3>{slide.title}</h3>
                  <p>{slide.content}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label="Next slide"
              className="carousel-arrow right"
              onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
            >
              {/* chevron-right icon */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="carousel-dots">
            {slides.map((_, index) => (
              <button
                key={index}
                aria-label={`Go to slide ${index + 1}`}
                className={`carousel-dot ${index === currentSlide ? "active" : ""}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>

        {/* ✅ Updated "How It Works" Section */}
        <div className="card">
          <h2 style={{ textAlign: "center", marginBottom: "2rem" }}>How It Works</h2>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <video
              ref={videoRef}
              onClick={handleVideoClick}
              width="60%"
              style={{
                cursor: "pointer",
                borderRadius: "8px",
                border: "2px dashed #e2e8f0",
              }}
              controls
              preload="none"
            >
              <source src="/BLOCKHIRE_v2.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <p style={{ textAlign: "center", color: "#666", marginTop: "1rem" }}>
            Click the video to play or pause
          </p>
        </div>
      </section>
    </Layout>
  )
}
